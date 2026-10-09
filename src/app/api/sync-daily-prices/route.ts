import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc } from 'firebase/firestore'
import * as cheerio from 'cheerio'

// This endpoint should be called daily via a Cron Job (e.g., GitHub Actions or Vercel Cron)
// It scrapes DawaaGate's latest price updates without slowing down the user's browser.
export async function GET() {
  try {
    const scrapedDrugs: any[] = []
    
    // We scrape the first 2 pages of updates to catch daily changes
    for (let page = 1; page <= 2; page++) {
      const url = `https://www.dawaagate.com/price-updates${page > 1 ? '?page=' + page : ''}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue
      
      const html = await res.text()
      const $ = cheerio.load(html)
      
      // In dawaagate, links to medicines have href like /medicine/...
      const medicineLinks = $('a[href^="/medicine/"]').toArray()
      
      for (const link of medicineLinks) {
        const href = $(link).attr('href')
        const name = $(link).text().trim()
        
        if (href && name && href !== '/medicine/a-z' && !href.includes('#')) {
          scrapedDrugs.push({ name, url: `https://www.dawaagate.com${href}` })
        }
      }
    }

    // Deduplicate array
    const uniqueDrugs = Array.from(new Map(scrapedDrugs.map(item => [item.url, item])).values())
    
    const updatedRecords = []

    // Fetch the price for the top 10 most recent updates to avoid timeout/blocking
    // A real production cron would process all of them slowly
    const topDrugsToUpdate = uniqueDrugs.slice(0, 10)

    for (const drug of topDrugsToUpdate) {
      try {
        const drugRes = await fetch(drug.url)
        if (!drugRes.ok) continue
        
        const drugHtml = await drugRes.text()
        const $$ = cheerio.load(drugHtml)
        
        // Find text like "سعر ... هو 120 جنيه"
        const pageText = $$('body').text()
        const priceMatch = pageText.match(/سعر.*?هو\s*([\d,.]+)\s*جنيه/)
        
        if (priceMatch && priceMatch[1]) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''))
          
          updatedRecords.push({
            name: drug.name,
            price: price,
            last_updated: new Date().toISOString()
          })
          
          // Save to Firestore central 'market_prices' collection
          await setDoc(doc(db, 'market_prices', drug.name.replace(/\//g, '-')), {
            name: drug.name,
            price: price,
            last_updated: new Date().toISOString()
          }, { merge: true })
        }
      } catch (err) {
        console.error('Error fetching drug details:', err)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'تم مزامنة أحدث أسعار الأدوية من السوق بنجاح.',
      updated_count: updatedRecords.length,
      records: updatedRecords
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
