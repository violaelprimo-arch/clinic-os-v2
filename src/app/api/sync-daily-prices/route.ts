import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc } from 'firebase/firestore'

// Scrapes DawaaGate's latest price updates cleanly without external edge-incompatible dependencies
export async function GET() {
  try {
    const scrapedDrugs: any[] = []
    
    // We scrape the first 2 pages of updates to catch daily changes
    for (let page = 1; page <= 2; page++) {
      const url = `https://www.dawaagate.com/price-updates${page > 1 ? '?page=' + page : ''}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue
      
      const html = await res.text()
      const linkRegex = /<a\s+[^>]*href=["'](\/medicine\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
      let match: RegExpExecArray | null
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1]
        const name = match[2].replace(/<[^>]+>/g, '').trim()
        if (href && name && href !== '/medicine/a-z' && !href.includes('#')) {
          scrapedDrugs.push({ name, url: `https://www.dawaagate.com${href}` })
        }
      }
    }

    // Deduplicate array
    const uniqueDrugs = Array.from(new Map(scrapedDrugs.map(item => [item.url, item])).values())
    
    const updatedRecords = []

    // Fetch the price for the top 10 most recent updates to avoid timeout/blocking
    const topDrugsToUpdate = uniqueDrugs.slice(0, 10)

    for (const drug of topDrugsToUpdate) {
      try {
        const drugRes = await fetch(drug.url)
        if (!drugRes.ok) continue
        
        const drugHtml = await drugRes.text()
        const pageText = drugHtml.replace(/<[^>]+>/g, ' ')
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
