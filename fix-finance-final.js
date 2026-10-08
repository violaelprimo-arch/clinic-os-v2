const fs = require('fs');

let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');

// Replace totals initialization
c = c.replace(
  `const [totals, setTotals] = useState({
    revenue: 3450,
    patients: 42,
    collected: 2850,
    due: 600,
    cash: 2208,
    instapay: 931,
    wallet: 311
  })`,
  `const [totals, setTotals] = useState({
    revenue: 0,
    patients: 0,
    collected: 0,
    due: 0,
    cash: 0,
    instapay: 0,
    wallet: 0
  })`
);

// Add state for charts
c = c.replace(
  `const [isLoading, setIsLoading] = useState(false)`,
  `const [isLoading, setIsLoading] = useState(false)\n  const [dailyData, setDailyData] = useState<any[]>([])\n  const [servicesData, setServicesData] = useState<any[]>([])\n  const [paymentsData, setPaymentsData] = useState<any[]>([])`
);

// Remove hardcoded dailyData
c = c.replace(
  `const dailyData = [
    { day: 'السبت', val: 450, pct: 40 },
    { day: 'الأحد', val: 700, pct: 60 },
    { day: 'الاثنين', val: 1200, pct: 100 },
    { day: 'الثلاثاء', val: 550, pct: 50 },
    { day: 'الأربعاء', val: 300, pct: 25 },
    { day: 'الخميس', val: 250, pct: 20 },
    { day: 'الجمعة', val: 0, pct: 0 }
  ]`,
  ``
);

// We need to inject the chart logic inside generateReport
const genRepFind = `      const appts = snapshot.docs.map(d => {
        const data = d.data()
        const price = Number(data.servicePrice) || 0
        rev += price

        if (data.paymentStatus === 'paid' || data.status === 'completed') {
          coll += price
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
        } else {
          due += price
        }
        return { id: d.id, ...data }
      })

      if (appts.length > 0) {
        setReport(appts)
        setTotals({
          revenue: rev,
          patients: appts.length,
          collected: coll,
          due: due,
          cash: csh,
          instapay: inst,
          wallet: wllt
        })
      }`;

const genRepReplace = `      let servicesMap: any = {}
      let daysMap: any = { 'Saturday': 0, 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0 }
      
      const appts = snapshot.docs.map(d => {
        const data = d.data()
        const price = Number(data.servicePrice) || 0
        
        // Count services
        if (data.serviceName) {
          servicesMap[data.serviceName] = (servicesMap[data.serviceName] || 0) + 1
        }

        rev += price

        if (data.paymentStatus === 'paid' || data.status === 'completed') {
          coll += price
          if (data.paymentMethod === 'wallet') wllt += price
          else if (data.paymentMethod === 'instapay') inst += price
          else csh += price
          
          // Map daily collected revenue
          if (data.date) {
            const dateObj = new Date(data.date)
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
            if (daysMap[dayName] !== undefined) {
              daysMap[dayName] += price
            }
          }
        } else {
          due += price
        }
        return { id: d.id, ...data }
      })

      setReport(appts)
      setTotals({
        revenue: rev,
        patients: appts.length,
        collected: coll,
        due: due,
        cash: csh,
        instapay: inst,
        wallet: wllt
      })

      // Prepare Daily Chart
      const arDays: any = { 'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين', 'Tuesday': 'الثلاثاء', 'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة' }
      let maxDay = 1 // to avoid division by zero
      Object.values(daysMap).forEach((v: any) => { if (v > maxDay) maxDay = v })
      const newDaily = Object.keys(daysMap).map(k => ({
        day: arDays[k],
        val: daysMap[k],
        pct: (daysMap[k] / maxDay) * 100
      }))
      setDailyData(newDaily)

      // Prepare Services Chart
      let totalServices = 0
      Object.values(servicesMap).forEach((v: any) => totalServices += v)
      const colors = ['bg-[#15B8A6]', 'bg-[#2F80ED]', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500']
      const newServices = Object.keys(servicesMap).map((k, idx) => ({
        name: k,
        pct: totalServices > 0 ? Math.round((servicesMap[k] / totalServices) * 100) : 0,
        color: colors[idx % colors.length]
      })).sort((a,b) => b.pct - a.pct)
      setServicesData(newServices)

      // Prepare Payments Chart
      const totalCollected = coll || 1
      setPaymentsData([
        { name: 'كاش بالعيادة', pct: Math.round((csh / totalCollected) * 100), color: 'bg-emerald-500' },
        { name: 'InstaPay', pct: Math.round((inst / totalCollected) * 100), color: 'bg-purple-500' },
        { name: 'محفظة إلكترونية', pct: Math.round((wllt / totalCollected) * 100), color: 'bg-blue-500' }
      ])`;

c = c.replace(genRepFind, genRepReplace);

const uiFind1 = `            <div className="space-y-2.5 pt-1">
              {[
                { name: 'كشف عادي', pct: 54, color: 'bg-[#15B8A6]' },
                { name: 'استشارة', pct: 21, color: 'bg-[#2F80ED]' },
                { name: 'كشف مستعجل', pct: 17, color: 'bg-amber-500' },
                { name: 'متابعة', pct: 8, color: 'bg-emerald-500' }
              ].map((s, idx) => (`;
              
const uiReplace1 = `            <div className="space-y-2.5 pt-1">
              {servicesData.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات كافية</p> : servicesData.map((s, idx) => (`;
              
c = c.replace(uiFind1, uiReplace1);

const uiFind2 = `            <div className="space-y-2.5 pt-1">
              {[
                { name: 'كاش بالعيادة', pct: 64, color: 'bg-emerald-500' },
                { name: 'InstaPay', pct: 27, color: 'bg-purple-500' },
                { name: 'محفظة إلكترونية (محفظة إلكترونية)', pct: 9, color: 'bg-blue-500' }
              ].map((p, idx) => (`;
              
const uiReplace2 = `            <div className="space-y-2.5 pt-1">
              {paymentsData.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات كافية</p> : paymentsData.map((p, idx) => (`;
              
c = c.replace(uiFind2, uiReplace2);

const effectFind = `const generateReport = async () => {`;
const effectReplace = `useEffect(() => {
    generateReport()
  }, [slug])

  const generateReport = async () => {`;
c = c.replace(effectFind, effectReplace);

fs.writeFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', c);
