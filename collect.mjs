// Collecteur des annonces publiques PPMP. Nécessite Node.js et Playwright.
// Usage : node ppmp-collector.mjs [fichier-sortie.json]
// Écriture atomique : conserve la précédente collecte si une page échoue.
import { chromium } from 'playwright';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const destination=process.argv[2]||'ppmp-catalogue.json';
await mkdir(dirname(destination),{recursive:true});
const source='https://www.marchespublics.gov.ma/index.php5?page=entreprise.EntrepriseAdvancedSearch&AllCons&EnCours';
const browser=await chromium.launch({headless:true});
console.log('Navigateur démarré');
const page=await browser.newPage();
const records=new Map();const signatures=new Set();let pages=0;
const action='a:has(img[alt="Accéder à la consultation"])';
try{
 await page.goto(source,{waitUntil:'domcontentloaded',timeout:60000});
 console.log('Page publique chargée');
 await page.locator(action).first().waitFor({timeout:30000});
 await page.locator('#ctl0_CONTENU_PAGE_resultSearch_listePageSizeTop').selectOption('100');
 console.log('Taille 100 sélectionnée');
 // Attendre le postback déclenché par le changement de taille avant toute navigation.
 await page.waitForFunction(()=>document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_numPageTop')?.value==='1'&&document.querySelectorAll('a img[alt="Accéder à la consultation"]').length===100,{},{timeout:45000});
 console.log('Début du parcours depuis la page 1');
 for(let n=1;n<=1000;n++){
  // Le numéro de page arrive avant la fin du rendu du tableau : attendre chaque ligne.
  await page.waitForFunction(expected=>{const total=Number(document.body.innerText.match(/Nombre de résultats\s*:\s*(\d+)/)?.[1]);return Number(document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_numPageTop')?.value)===expected&&total>0&&document.querySelectorAll('a img[alt="Accéder à la consultation"]').length===Math.min(100,total-(expected-1)*100)},n,{timeout:45000});
  await page.locator(action).first().waitFor({timeout:30000});
  const result=await page.evaluate(()=>{
   const clean=s=>(s||'').replace(/\s+/g,' ').trim();
   const read=(row,selector)=>clean(row.querySelector(selector)?.innerText);
   const links=[...document.querySelectorAll('a')].filter(a=>a.querySelector('img[alt="Accéder à la consultation"]'));
   const rows=links.map(a=>{const row=a.closest('tr');const u=new URL(a.href);const category=read(row,'[id$="panelBlocCategorie"]');const text=read(row,'[headers="cons_ref"]');const dates=text.match(/\d{2}\/\d{2}\/\d{4}/g)||[];
    return {id:u.searchParams.get('orgAcronyme')+':'+u.searchParams.get('refConsultation'),consultationId:u.searchParams.get('refConsultation'),organisationId:u.searchParams.get('orgAcronyme'),reference:read(row,'.ref'),title:read(row,'[id$="panelBlocObjet"]').replace(/^Objet\s*:\s*/,''),buyer:read(row,'[id$="panelBlocDenomination"]').replace(/^Acheteur public\s*:\s*/,''),category,procedure:read(row,'[id$="type_procedure"]'),publicationDate:dates.at(-1)||null,deadlineRaw:read(row,'[headers="cons_dateEnd"]'),locations:read(row,'[id$="panelBlocLieuxExec"]'),url:u.href,source:'PPMP'};
   });
   const pager=document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_panelBouttonGotoPageTop');
   return {rows,current:Number(document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_numPageTop')?.value),total:Number(pager?.innerText.match(/\/\s*(\d+)/)?.[1]),next:!!document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_PagerTop_ctl2')};
  });
  if(result.current!==n||!result.rows.length||!result.total)throw Error('Pagination ou structure inattendue — aucune publication du résultat.');
  const signature=result.rows.map(r=>r.id).join('|');if(signatures.has(signature))throw Error('Page répétée');signatures.add(signature);
  for(const r of result.rows){if(!r.consultationId||!r.organisationId||!r.reference||!r.title||!r.buyer)throw Error('Fiche incomplète');records.set(r.id,r)}
  pages++;
  console.log(JSON.stringify({page:n,totalPages:result.total,rows:result.rows.length,uniqueAnnouncements:records.size}));
  if(n>=result.total)break;
  if(!result.next||n===1000)throw Error('Collecte incomplète');
  await page.waitForTimeout(2500);
  await page.locator('#ctl0_CONTENU_PAGE_resultSearch_PagerTop_ctl2').click();
  await page.waitForFunction(expected=>Number(document.querySelector('#ctl0_CONTENU_PAGE_resultSearch_numPageTop')?.value)===expected,n+1,{timeout:45000});
 }
 // Enchères, délégations et autres annonces ne sont pas automatiquement assimilées à des marchés.
 const all=[...records.values()];const market=r=>/appel d.offres|concours|consultation architecturale|marché négocié/i.test(r.procedure);
 const payload={schemaVersion:1,sourceUrl:source,completedAt:new Date().toISOString(),status:'complete_for_active_consultations_listing',pagesScanned:pages,announcementsScanned:all.length,records:all.filter(market),excludedAnnouncements:all.filter(r=>!market(r)).length,scope:'Consultations en cours uniquement ; BDC, archives, résultats et annulations hors périmètre de cette version.'};
 await writeFile(destination+'.tmp',JSON.stringify(payload,null,2));await rename(destination+'.tmp',destination);
 console.log(JSON.stringify({completedAt:payload.completedAt,pages,markets:payload.records.length,excluded:payload.excludedAnnouncements}));
}catch(e){console.error('Collecte interrompue : '+e.message);process.exitCode=1}finally{await browser.close()}
