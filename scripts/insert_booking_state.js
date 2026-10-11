const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const target = "const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])";

const addition = `const [dailyBookingCounts, setDailyBookingCounts] = useState<{ [date: string]: number }>({})

  // Fetch existing appointments count to enforce maxDailyBookings limit
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const fetchCounts = async () => {
      try {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinic.id || clinic.slug)
        )
        const snap = await getDocs(q)
        const counts: { [date: string]: number } = {}
        snap.docs.forEach(docSnap => {
          const d = docSnap.data()
          if (d.date && d.status !== 'cancelled') {
            counts[d.date] = (counts[d.date] || 0) + 1
          }
        })
        setDailyBookingCounts(counts)
      } catch (err) {
        console.error('Error fetching booking counts:', err)
      }
    }
    fetchCounts()
  }, [clinic?.id, clinic?.slug])

  // Compute available days: only open days in weeklySchedule & not exceeding maxDailyBookings
  const availableDays = useMemo(() => {
    const list: { iso: string; label: string; formattedDate: string }[] = []
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]

    const maxLimit = Number(clinic?.maxDailyBookings) || 0

    // Scan up to 14 days ahead
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const dayNum = String(d.getDate()).padStart(2, '0')
      const iso = \`\${year}-\${month}-\${dayNum}\`

      const dayIndex = d.getDay()
      const dayKey = dayKeys[dayIndex]
      const dayNameAr = dayNamesAr[dayIndex]

      // Check weeklySchedule: if clinic is closed on this day, SKIP
      if (clinic?.weeklySchedule && clinic.weeklySchedule.length > 0) {
        const sched = clinic.weeklySchedule.find((s: any) => s.id === dayKey)
        if (sched && sched.isOpen === false) {
          continue
        }
      }

      // Check max daily bookings: if day is full, SKIP
      const bookedCount = dailyBookingCounts[iso] || 0
      if (maxLimit > 0 && bookedCount >= maxLimit) {
        continue
      }

      let label = dayNameAr
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      const formattedDate = \`\${d.getDate()} \${monthNamesAr[d.getMonth()]}\`

      list.push({
        iso,
        label,
        formattedDate
      })

      // Show up to 6 active available days
      if (list.length >= 6) break
    }

    return list
  }, [clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts])

  const [selectedDate, setSelectedDate] = useState<string>('')

  // Keep selectedDate pointed to the first valid available day
  useEffect(() => {
    if (availableDays.length > 0) {
      const isSelectedAvailable = availableDays.some(d => d.iso === selectedDate)
      if (!isSelectedAvailable) {
        setSelectedDate(availableDays[0].iso)
      }
    }
  }, [availableDays, selectedDate])`;

c = c.replace(target, addition);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c, 'utf8');
console.log('Inserted dailyBookingCounts & availableDays into BookingForm.tsx!');
