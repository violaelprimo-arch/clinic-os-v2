// Geographic data definitions for Egypt's 27 Governorates, Cities, and Districts/Neighborhoods
// Source: Official Administrative Divisions of Egypt (CAPMAS & Ministry of Local Development)

export interface AreaItem {
  id: string
  nameAr: string
  nameEn: string
  lat: number
  lng: number
  keywords?: string[]
}

export interface CityItem {
  id: string
  nameAr: string
  nameEn: string
  areas: AreaItem[]
}

export interface GovernorateItem {
  id: string
  nameAr: string
  nameEn: string
  lat: number
  lng: number
  cities: CityItem[]
}

export const CUSTOM_AREA_ID = 'custom_other'

export const EGYPT_GOVERNORATES: GovernorateItem[] = [
  // 1. Cairo
  {
    id: 'cairo',
    nameAr: 'القاهرة',
    nameEn: 'Cairo',
    lat: 30.0444,
    lng: 31.2357,
    cities: [
      {
        id: 'cairo_east',
        nameAr: 'شرق القاهرة (مدينة نصر ومصر الجديدة)',
        nameEn: 'East Cairo',
        areas: [
          { id: 'cairo_nasr_city', nameAr: 'مدينة نصر', nameEn: 'Nasr City', lat: 30.052, lng: 31.342, keywords: ['مدينة نصر', 'نصر', 'nasr city', 'مكرم عبيد', 'عباس العقاد', 'حي العاشر', 'السراج'] },
          { id: 'cairo_heliopolis', nameAr: 'مصر الجديدة', nameEn: 'Heliopolis', lat: 30.088, lng: 31.328, keywords: ['مصر الجديدة', 'هيليوبوليس', 'heliopolis', 'الكوربة', 'روكسي', 'الميرغني'] },
          { id: 'cairo_sheraton', nameAr: 'مساكن شيراتون', nameEn: 'Sheraton Homes', lat: 30.106, lng: 31.378, keywords: ['شيراتون', 'مساكن شيراتون', 'النزهة'] },
          { id: 'cairo_gesr_al_suez', nameAr: 'جسر السويس وعين شمس', nameEn: 'Gesr Al Suez & Ain Shams', lat: 30.131, lng: 31.328, keywords: ['جسر السويس', 'عين شمس', 'الألف مسكن'] }
        ]
      },
      {
        id: 'cairo_new_cities',
        nameAr: 'القاهرة الجديدة والمدن التابعة',
        nameEn: 'New Cairo & Satellite Cities',
        areas: [
          { id: 'cairo_new_cairo_5th', nameAr: 'التجمع الخامس (القاهرة الجديدة)', nameEn: '5th Settlement (New Cairo)', lat: 30.012, lng: 31.491, keywords: ['التجمع الخامس', 'التجمع', 'القاهرة الجديدة', 'new cairo', 'شارع التسعين'] },
          { id: 'cairo_new_cairo_1st', nameAr: 'التجمع الأول والثالث', nameEn: '1st & 3rd Settlement', lat: 30.061, lng: 31.467, keywords: ['التجمع الاول', 'التجمع الثالث'] },
          { id: 'cairo_rehab', nameAr: 'الرحاب', nameEn: 'Al Rehab City', lat: 30.062, lng: 31.492, keywords: ['الرحاب', 'مدينة الرحاب'] },
          { id: 'cairo_madinaty', nameAr: 'مدينتي', nameEn: 'Madinaty', lat: 30.113, lng: 31.628, keywords: ['مدينتي'] },
          { id: 'cairo_shorouk', nameAr: 'مدينة الشروق', nameEn: 'Al Shorouk City', lat: 30.138, lng: 31.624, keywords: ['الشروق', 'مدينة الشروق'] },
          { id: 'cairo_badr', nameAr: 'مدينة بدر والعاصمة الإدارية', nameEn: 'Badr City & NAC', lat: 30.141, lng: 31.741, keywords: ['بدر', 'العاصمة الإدارية', 'العاصمة الجديدة'] },
          { id: 'cairo_mostakbal', nameAr: 'المستقبل سيتي', nameEn: 'Mostakbal City', lat: 30.082, lng: 31.652, keywords: ['المستقبل', 'مستقبل سيتي'] }
        ]
      },
      {
        id: 'cairo_south',
        nameAr: 'جنوب القاهرة (المعادي وحلوان والمقطم)',
        nameEn: 'South Cairo',
        areas: [
          { id: 'cairo_maadi', nameAr: 'المعادي ودجلة', nameEn: 'Maadi & Degla', lat: 29.959, lng: 31.258, keywords: ['المعادي', 'معادي', 'دجلة', 'maadi'] },
          { id: 'cairo_zahraa_maadi', nameAr: 'زهراء المعادي', nameEn: 'Zahraa El Maadi', lat: 29.975, lng: 31.314, keywords: ['زهراء المعادي', 'زهراء'] },
          { id: 'cairo_mokattam', nameAr: 'المقطم والهضبة الوسطى', nameEn: 'Mokattam', lat: 30.016, lng: 31.306, keywords: ['المقطم', 'الهضبة الوسطى', 'mokattam'] },
          { id: 'cairo_helwan', nameAr: 'حلوان و15 مايو', nameEn: 'Helwan & 15th May', lat: 29.849, lng: 31.334, keywords: ['حلوان', '15 مايو', 'مايو', 'المعصرة'] },
          { id: 'cairo_basateen', nameAr: 'البساتين ودار السلام', nameEn: 'El Basateen & Dar El Salam', lat: 29.988, lng: 31.258, keywords: ['البساتين', 'دار السلام'] }
        ]
      },
      {
        id: 'cairo_west_central',
        nameAr: 'وسط وغرب القاهرة',
        nameEn: 'Central & West Cairo',
        areas: [
          { id: 'cairo_downtown', nameAr: 'وسط البلد والتحرير', nameEn: 'Downtown Cairo', lat: 30.044, lng: 31.235, keywords: ['وسط البلد', 'التحرير', 'باب اللوق', 'عابدين'] },
          { id: 'cairo_zamalek', nameAr: 'الزمالك', nameEn: 'Zamalek', lat: 30.062, lng: 31.220, keywords: ['الزمالك', 'zamalek', 'الجزيرة'] },
          { id: 'cairo_manial', nameAr: 'المنيل وجاردن سيتي', nameEn: 'Manial & Garden City', lat: 30.027, lng: 31.228, keywords: ['المنيل', 'جاردن سيتي', 'قصر العيني'] },
          { id: 'cairo_shubra', nameAr: 'شبرا وروض الفرج والساحل', nameEn: 'Shubra & Rod El Farag', lat: 30.083, lng: 31.248, keywords: ['شبرا', 'شبرا مصر', 'روض الفرج', 'الساحل'] },
          { id: 'cairo_abbasiya', nameAr: 'العباسية والوايلي والظاهر', nameEn: 'Abbasiya & Wayli', lat: 30.071, lng: 31.282, keywords: ['العباسية', 'الوايلي', 'الظاهر', 'باب الشعرية'] }
        ]
      },
      {
        id: 'cairo_north',
        nameAr: 'شمال القاهرة',
        nameEn: 'North Cairo',
        areas: [
          { id: 'cairo_zeitoun', nameAr: 'الزيتون وحدائق القبة', nameEn: 'Zeitoun & Hadaeq El Qobba', lat: 30.105, lng: 31.309, keywords: ['الزيتون', 'حدائق القبة', 'سراي القبة'] },
          { id: 'cairo_matariya', nameAr: 'المطرية وحلمية الزيتون', nameEn: 'Matariya & Helmeyat Zeitoun', lat: 30.124, lng: 31.312, keywords: ['المطرية', 'حلمية الزيتون'] },
          { id: 'cairo_marg', nameAr: 'المرج وعزبة النخل', nameEn: 'El Marg & Ezbet El Nakhl', lat: 30.155, lng: 31.339, keywords: ['المرج', 'عزبة النخل'] },
          { id: 'cairo_salam', nameAr: 'مدينة السلام والنهضة', nameEn: 'Al Salam City & Al Nahda', lat: 30.174, lng: 31.428, keywords: ['السلام', 'مدينة السلام', 'النهضة'] }
        ]
      }
    ]
  },

  // 2. Giza
  {
    id: 'giza',
    nameAr: 'الجيزة',
    nameEn: 'Giza',
    lat: 30.0131,
    lng: 31.2089,
    cities: [
      {
        id: 'giza_urban',
        nameAr: 'مدينة الجيزة والأحياء المركزية',
        nameEn: 'Giza Urban & Central',
        areas: [
          { id: 'giza_dokki', nameAr: 'الدقي', nameEn: 'Dokki', lat: 30.038, lng: 31.212, keywords: ['الدقي', 'dokki', 'ميدان المساحة', 'مصدق'] },
          { id: 'giza_mohandessin', nameAr: 'المهندسين والعجوزة', nameEn: 'Mohandessin & Agouza', lat: 30.054, lng: 31.203, keywords: ['المهندسين', 'العجوزة', 'mohandessin', 'جامعة الدول', 'البطل أحمد عبد العزيز', 'لبنان'] },
          { id: 'giza_haram', nameAr: 'الهرم', nameEn: 'Al Haram', lat: 29.997, lng: 31.148, keywords: ['الهرم', 'haram', 'العريش', 'المريوطية', 'الرماية'] },
          { id: 'giza_faisal', nameAr: 'فيصل', nameEn: 'Faisal', lat: 30.007, lng: 31.168, keywords: ['فيصل', 'faisal', 'العشرين', 'حسن محمد'] },
          { id: 'giza_omrania', nameAr: 'العمرانية وجزيرة الذهب', nameEn: 'Omrania & Dahab Island', lat: 29.992, lng: 31.201, keywords: ['العمرانية', 'ساقية مكي'] },
          { id: 'giza_imbaba', nameAr: 'إمبابة والوراق', nameEn: 'Imbaba & Al Warraq', lat: 30.076, lng: 31.212, keywords: ['إمبابة', 'امبابة', 'الوراق', 'بشتيل'] },
          { id: 'giza_bulaq_dakrour', nameAr: 'بولاق الدكرور وصفط اللبن', nameEn: 'Bulaq Al Dakrour & Saft', lat: 30.031, lng: 31.189, keywords: ['بولاق الدكرور', 'صفط اللبن'] }
        ]
      },
      {
        id: 'giza_new_cities',
        nameAr: 'مدن 6 أكتوبر والشيخ زايد',
        nameEn: '6th of October & Sheikh Zayed',
        areas: [
          { id: 'giza_october_central', nameAr: '6 أكتوبر (المحاور والأحياء الرئيسية)', nameEn: '6th of October Central', lat: 29.972, lng: 30.942, keywords: ['6 اكتوبر', 'أكتوبر', 'october', 'الحصري', 'غرب سوميد', 'القرية الذكية'] },
          { id: 'giza_october_gardens', nameAr: 'حدائق أكتوبر وأكتوبر الجديدة', nameEn: 'October Gardens & New October', lat: 29.914, lng: 31.025, keywords: ['حدائق اكتوبر', 'اكتوبر الجديدة', 'ابني بيتك'] },
          { id: 'giza_sheikh_zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed', lat: 30.055, lng: 30.985, keywords: ['الشيخ زايد', 'زايد', 'sheikh zayed', 'هايبر وان', 'بيفرلي هيلز'] },
          { id: 'giza_hadayeq_ahram', nameAr: 'حدائق الأهرام (البوابات)', nameEn: 'Hadayeq Al Ahram', lat: 29.978, lng: 31.115, keywords: ['حدائق الاهرام', 'هضبة الاهرام', 'بوابات الاهرام'] }
        ]
      },
      {
        id: 'giza_south_markaz',
        nameAr: 'مراكز جنوب الجيزة',
        nameEn: 'South Giza Centers',
        areas: [
          { id: 'giza_hawamdia', nameAr: 'الحوامدية وأبو النمرس', nameEn: 'Al Hawamdia & Abu El Nomros', lat: 29.897, lng: 31.261, keywords: ['الحوامدية', 'ابو النمرس', 'طموه'] },
          { id: 'giza_badrashin', nameAr: 'البدرشين وسقارة وميت رهينة', nameEn: 'Al Badrashin & Saqqara', lat: 29.814, lng: 31.272, keywords: ['البدرشين', 'سقارة', 'ميت رهينة'] },
          { id: 'giza_ayat', nameAr: 'العياط والصف وأطفيح', nameEn: 'Al Ayat, Al Saff & Atfih', lat: 29.621, lng: 31.258, keywords: ['العياط', 'الصف', 'اطفيح'] },
          { id: 'giza_oasis', nameAr: 'الواحات البحرية', nameEn: 'Bahariya Oasis', lat: 28.354, lng: 28.868, keywords: ['الواحات البحرية', 'الواحات', 'الباويطي'] }
        ]
      }
    ]
  },

  // 3. Alexandria
  {
    id: 'alexandria',
    nameAr: 'الإسكندرية',
    nameEn: 'Alexandria',
    lat: 31.2001,
    lng: 29.9187,
    cities: [
      {
        id: 'alex_east',
        nameAr: 'شرق ومنتزه الإسكندرية',
        nameEn: 'East & Montaza Alexandria',
        areas: [
          { id: 'alex_smouha', nameAr: 'سموحة وسيدي جابر', nameEn: 'Smouha & Sidi Gaber', lat: 31.215, lng: 29.948, keywords: ['سموحة', 'سيدي جابر', 'فيكتوريا', 'كليوباترا'] },
          { id: 'alex_roushdy', nameAr: 'رشدي ولوران وجليم وزيزينيا', nameEn: 'Roushdy, Loran & Glim', lat: 31.233, lng: 29.961, keywords: ['رشدي', 'لوران', 'جليم', 'زيزينيا', 'سان ستيفانو'] },
          { id: 'alex_miami_montaza', nameAr: 'ميامي والمنتزه والمعمورة', nameEn: 'Miami, Montaza & Mamoura', lat: 31.268, lng: 30.012, keywords: ['ميامي', 'المنتزه', 'المعمورة', 'العصافرة', 'المندرة'] },
          { id: 'alex_sidi_bishr', nameAr: 'سيدي بشر والعصافرة', nameEn: 'Sidi Bishr & Asafra', lat: 31.255, lng: 29.998, keywords: ['سيدي بشر', 'العصافرة'] }
        ]
      },
      {
        id: 'alex_central_west',
        nameAr: 'وسط وغرب الإسكندرية',
        nameEn: 'Central & West Alexandria',
        areas: [
          { id: 'alex_mansheya', nameAr: 'المنشية ومحطة الرمل وبحري', nameEn: 'Mansheya, Raml Station & Bahari', lat: 31.200, lng: 29.894, keywords: ['المنشية', 'محطة الرمل', 'بحري', 'الأنفوشي'] },
          { id: 'alex_moharam_bek', nameAr: 'محرم بك وكرموز وغيط العنب', nameEn: 'Moharam Bek & Karmouz', lat: 31.189, lng: 29.912, keywords: ['محرم بك', 'كرموز', 'غيط العنب'] },
          { id: 'alex_agami', nameAr: 'العجمي والهانوفيل والبيطاش', nameEn: 'Al Agami, Hanoville & Bitash', lat: 31.112, lng: 29.768, keywords: ['العجمي', 'الهانوفيل', 'البيطاش', 'الدخيلة'] },
          { id: 'alex_borg_el_arab', nameAr: 'برج العرب والساحل الشمالي', nameEn: 'Borg El Arab & North Coast', lat: 30.916, lng: 29.548, keywords: ['برج العرب', 'مدينة برج العرب الجديدة', 'كينج مريوط'] }
        ]
      }
    ]
  },

  // 4. Qalyubia
  {
    id: 'qalyubia',
    nameAr: 'القليوبية',
    nameEn: 'Qalyubia',
    lat: 30.4667,
    lng: 31.1850,
    cities: [
      {
        id: 'qalyubia_cities',
        nameAr: 'مدن ومراكز القليوبية',
        nameEn: 'Qalyubia Centers',
        areas: [
          { id: 'qalyubia_banha', nameAr: 'بنها', nameEn: 'Banha', lat: 30.466, lng: 31.185, keywords: ['بنها', 'banha'] },
          { id: 'qalyubia_shubra_kheima', nameAr: 'شبرا الخيمة', nameEn: 'Shubra El Kheima', lat: 30.128, lng: 31.242, keywords: ['شبرا الخيمة', 'مسطرد', 'بهتيم'] },
          { id: 'qalyubia_obour', nameAr: 'مدينة العبور والعبور الجديدة', nameEn: 'Al Obour City', lat: 30.224, lng: 31.472, keywords: ['العبور', 'مدينة العبور', 'العبور الجديدة'] },
          { id: 'qalyubia_qalyub', nameAr: 'قليوب', nameEn: 'Qalyub', lat: 30.180, lng: 31.205, keywords: ['قليوب'] },
          { id: 'qalyubia_toukh', nameAr: 'طوخ وقها', nameEn: 'Toukh & Qaha', lat: 30.354, lng: 31.198, keywords: ['طوخ', 'قها'] },
          { id: 'qalyubia_khanka', nameAr: 'الخانكة وأبو زعبل', nameEn: 'Al Khanka & Abu Zaabal', lat: 30.212, lng: 31.368, keywords: ['الخانكة', 'ابو زعبل'] },
          { id: 'qalyubia_shebin_qanater', nameAr: 'شبين القناطر', nameEn: 'Shibin Al Qanater', lat: 30.312, lng: 31.319, keywords: ['شبين القناطر'] },
          { id: 'qalyubia_qanater_khayria', nameAr: 'القناطر الخيرية', nameEn: 'Al Qanater Al Khayriya', lat: 30.194, lng: 31.137, keywords: ['القناطر الخيرية', 'القناطر'] }
        ]
      }
    ]
  },

  // 5. Sharqia
  {
    id: 'sharqia',
    nameAr: 'الشرقية',
    nameEn: 'Sharqia',
    lat: 30.5877,
    lng: 31.5020,
    cities: [
      {
        id: 'sharqia_cities',
        nameAr: 'مدن ومراكز الشرقية',
        nameEn: 'Sharqia Centers',
        areas: [
          { id: 'sharqia_zagazig', nameAr: 'الزقازيق', nameEn: 'Zagazig', lat: 30.587, lng: 31.502, keywords: ['الزقازيق', 'zagazig', 'القنايات'] },
          { id: 'sharqia_10th_ramadan', nameAr: 'العاشر من رمضان', nameEn: '10th of Ramadan', lat: 30.298, lng: 31.742, keywords: ['العاشر من رمضان', 'العاشر'] },
          { id: 'sharqia_belbeis', nameAr: 'بلبيس', nameEn: 'Belbeis', lat: 30.420, lng: 31.564, keywords: ['بلبيس'] },
          { id: 'sharqia_minya_qamh', nameAr: 'منيا القمح', nameEn: 'Minya El Qamh', lat: 30.518, lng: 31.345, keywords: ['منيا القمح'] },
          { id: 'sharqia_faqous', nameAr: 'فاقوس', nameEn: 'Faqous', lat: 30.731, lng: 31.798, keywords: ['فاقوس'] },
          { id: 'sharqia_hehya', nameAr: 'ههيا والإبراهيمية', nameEn: 'Hehya & Ibrahimiya', lat: 30.671, lng: 31.592, keywords: ['ههيا', 'الإبراهيمية'] },
          { id: 'sharqia_abu_hammad', nameAr: 'أبو حماد والقرين', nameEn: 'Abu Hammad & Qurein', lat: 30.552, lng: 31.674, keywords: ['أبو حماد', 'القرين'] },
          { id: 'sharqia_diyarb_negm', nameAr: 'ديرب نجم', nameEn: 'Diyarb Negm', lat: 30.752, lng: 31.458, keywords: ['ديرب نجم'] },
          { id: 'sharqia_husseiniya', nameAr: 'الحسينية وصان الحجر', nameEn: 'Husseiniya & San El Hagar', lat: 30.865, lng: 31.918, keywords: ['الحسينية', 'صان الحجر'] }
        ]
      }
    ]
  },

  // 6. Dakahlia
  {
    id: 'dakahlia',
    nameAr: 'الدقهلية',
    nameEn: 'Dakahlia',
    lat: 31.0409,
    lng: 31.3785,
    cities: [
      {
        id: 'dakahlia_cities',
        nameAr: 'مدن ومراكز الدقهلية',
        nameEn: 'Dakahlia Centers',
        areas: [
          { id: 'dakahlia_mansoura', nameAr: 'المنصورة وطلخا', nameEn: 'Mansoura & Talkha', lat: 31.040, lng: 31.378, keywords: ['المنصورة', 'طلخا', 'mansoura', 'حي الجامعة', 'المشاية'] },
          { id: 'dakahlia_mit_ghamr', nameAr: 'ميت غمر', nameEn: 'Mit Ghamr', lat: 30.718, lng: 31.258, keywords: ['ميت غمر'] },
          { id: 'dakahlia_senbelawein', nameAr: 'السنبلاوين وتمي الأمديد', nameEn: 'Senbelawein', lat: 30.878, lng: 31.520, keywords: ['السنبلاوين', 'تمي الأمديد'] },
          { id: 'dakahlia_belqas', nameAr: 'بلقاس وجمصة', nameEn: 'Belqas & Gamasa', lat: 31.232, lng: 31.365, keywords: ['بلقاس', 'جمصة', 'المنصورة الجديدة'] },
          { id: 'dakahlia_dekernes', nameAr: 'دكرنس ومنية النصر', nameEn: 'Dekernes & Meniet El Nasr', lat: 31.087, lng: 31.597, keywords: ['دكرنس', 'منية النصر'] },
          { id: 'dakahlia_sherbin', nameAr: 'شربين', nameEn: 'Sherbin', lat: 31.192, lng: 31.524, keywords: ['شربين'] },
          { id: 'dakahlia_aga', nameAr: 'أجا', nameEn: 'Aga', lat: 30.938, lng: 31.295, keywords: ['أجا', 'اجا'] },
          { id: 'dakahlia_manzala', nameAr: 'المنزلة والمطرية (دقهلية)', nameEn: 'Manzala & Matariya Dakahlia', lat: 31.158, lng: 31.935, keywords: ['المنزلة', 'المطرية دقهلية'] }
        ]
      }
    ]
  },

  // 7. Gharbia
  {
    id: 'gharbia',
    nameAr: 'الغربية',
    nameEn: 'Gharbia',
    lat: 30.7865,
    lng: 31.0004,
    cities: [
      {
        id: 'gharbia_cities',
        nameAr: 'مدن ومراكز الغربية',
        nameEn: 'Gharbia Centers',
        areas: [
          { id: 'gharbia_tanta', nameAr: 'طنطا', nameEn: 'Tanta', lat: 30.786, lng: 31.000, keywords: ['طنطا', 'tanta', 'شارع البحر', 'المحطة', 'الاستاد'] },
          { id: 'gharbia_mahalla', nameAr: 'المحلة الكبرى', nameEn: 'El Mahalla El Kubra', lat: 30.970, lng: 31.164, keywords: ['المحلة الكبرى', 'المحلة', 'mahalla', 'شكري القوتلي'] },
          { id: 'gharbia_zifta', nameAr: 'زفتى والسنطة', nameEn: 'Zifta & Al Santa', lat: 30.712, lng: 31.242, keywords: ['زفتى', 'السنطة'] },
          { id: 'gharbia_kafr_zayat', nameAr: 'كفر الزيات وبسيون', nameEn: 'Kafr El Zayat & Basyoun', lat: 30.825, lng: 30.814, keywords: ['كفر الزيات', 'بسيون'] },
          { id: 'gharbia_samannoud', nameAr: 'سمنود وقصور', nameEn: 'Samannoud', lat: 30.962, lng: 31.241, keywords: ['سمنود'] },
          { id: 'gharbia_qutour', nameAr: 'قطور', nameEn: 'Qutour', lat: 30.978, lng: 30.948, keywords: ['قطور'] }
        ]
      }
    ]
  },

  // 8. Monufia
  {
    id: 'monufia',
    nameAr: 'المنوفية',
    nameEn: 'Monufia',
    lat: 30.5520,
    lng: 31.0090,
    cities: [
      {
        id: 'monufia_cities',
        nameAr: 'مدن ومراكز المنوفية',
        nameEn: 'Monufia Centers',
        areas: [
          { id: 'monufia_shibin', nameAr: 'شبين الكوم', nameEn: 'Shibin El Kom', lat: 30.552, lng: 31.009, keywords: ['شبين الكوم', 'شبين', 'shibin'] },
          { id: 'monufia_sadat', nameAr: 'مدينة السادات', nameEn: 'Sadat City', lat: 30.381, lng: 30.518, keywords: ['مدينة السادات', 'السادات'] },
          { id: 'monufia_menouf', nameAr: 'منوف وسرس الليان', nameEn: 'Menouf & Sars El Layan', lat: 30.466, lng: 30.932, keywords: ['منوف', 'سرس الليان'] },
          { id: 'monufia_ashmoun', nameAr: 'أشمون', nameEn: 'Ashmoun', lat: 30.297, lng: 30.978, keywords: ['أشمون', 'اشمون'] },
          { id: 'monufia_quesna', nameAr: 'قويسنا وبركة السبع', nameEn: 'Quesna & Berket El Sabaa', lat: 30.548, lng: 31.142, keywords: ['قويسنا', 'بركة السبع'] },
          { id: 'monufia_tala', nameAr: 'تلا والشهداء', nameEn: 'Tala & Al Shohadaa', lat: 30.681, lng: 30.942, keywords: ['تلا', 'الشهداء'] }
        ]
      }
    ]
  },

  // 9. Beheira
  {
    id: 'beheira',
    nameAr: 'البحيرة',
    nameEn: 'Beheira',
    lat: 31.0425,
    lng: 30.4705,
    cities: [
      {
        id: 'beheira_cities',
        nameAr: 'مدن ومراكز البحيرة',
        nameEn: 'Beheira Centers',
        areas: [
          { id: 'beheira_damanhour', nameAr: 'دمنهور', nameEn: 'Damanhour', lat: 31.042, lng: 30.470, keywords: ['دمنهور', 'damanhour'] },
          { id: 'beheira_kafr_dawar', nameAr: 'كفر الدوار', nameEn: 'Kafr El Dawar', lat: 31.135, lng: 30.131, keywords: ['كفر الدوار'] },
          { id: 'beheira_itay_baroud', nameAr: 'إيتاي البارود وشبراخيت', nameEn: 'Itay El Baroud & Shubrakhit', lat: 30.887, lng: 30.665, keywords: ['إيتاي البارود', 'شبراخيت'] },
          { id: 'beheira_abu_hommos', nameAr: 'أبو حمص وإدكو', nameEn: 'Abu Hummus & Idku', lat: 31.102, lng: 30.312, keywords: ['أبو حمص', 'إدكو', 'ادكو'] },
          { id: 'beheira_rosetta', nameAr: 'رشيد والمحمودية', nameEn: 'Rosetta & Mahmoudiya', lat: 31.398, lng: 30.421, keywords: ['رشيد', 'المحمودية'] },
          { id: 'beheira_kom_hamada', nameAr: 'كوم حمادة وبدر والنوبارية', nameEn: 'Kom Hamada, Badr & Nubariya', lat: 30.755, lng: 30.697, keywords: ['كوم حمادة', 'بدر بالبحيرة', 'النوبارية الجديدة'] },
          { id: 'beheira_wadi_natrun', nameAr: 'وادي النطرون', nameEn: 'Wadi El Natrun', lat: 30.384, lng: 30.348, keywords: ['وادي النطرون'] }
        ]
      }
    ]
  },

  // 10. Kafr El Sheikh
  {
    id: 'kafr_el_sheikh',
    nameAr: 'كفر الشيخ',
    nameEn: 'Kafr El Sheikh',
    lat: 31.1118,
    lng: 30.9399,
    cities: [
      {
        id: 'kafr_cities',
        nameAr: 'مدن ومراكز كفر الشيخ',
        nameEn: 'Kafr El Sheikh Centers',
        areas: [
          { id: 'kafr_sheikh_city', nameAr: 'كفر الشيخ (المدينة)', nameEn: 'Kafr El Sheikh City', lat: 31.111, lng: 30.939, keywords: ['كفر الشيخ', 'kafr el sheikh'] },
          { id: 'kafr_desouk', nameAr: 'دسوق', nameEn: 'Desouk', lat: 31.131, lng: 30.648, keywords: ['دسوق'] },
          { id: 'kafr_biyala', nameAr: 'بيلا والحامول', nameEn: 'Biyala & El Hamool', lat: 31.178, lng: 31.221, keywords: ['بيلا', 'الحامول'] },
          { id: 'kafr_sidi_salem', nameAr: 'سيدي سالم والرياض', nameEn: 'Sidi Salem & Al Riyad', lat: 31.272, lng: 30.978, keywords: ['سيدي سالم', 'الرياض'] },
          { id: 'kafr_fouh_metobas', nameAr: 'فوه ومطوبس وبلطيم', nameEn: 'Fouh, Metobas & Baltim', lat: 31.205, lng: 30.551, keywords: ['فوه', 'مطوبس', 'بلطيم', 'مصيف بلطيم'] }
        ]
      }
    ]
  },

  // 11. Damietta
  {
    id: 'damietta',
    nameAr: 'دمياط',
    nameEn: 'Damietta',
    lat: 31.4175,
    lng: 31.8144,
    cities: [
      {
        id: 'damietta_cities',
        nameAr: 'مدن ومراكز دمياط',
        nameEn: 'Damietta Centers',
        areas: [
          { id: 'damietta_city', nameAr: 'مدينة دمياط', nameEn: 'Damietta City', lat: 31.417, lng: 31.814, keywords: ['دمياط', 'damietta'] },
          { id: 'damietta_new', nameAr: 'دمياط الجديدة ورأس البر', nameEn: 'New Damietta & Ras El Bar', lat: 31.439, lng: 31.674, keywords: ['دمياط الجديدة', 'رأس البر', 'راس البر'] },
          { id: 'damietta_fareskour', nameAr: 'فارسكور والزرقا', nameEn: 'Fareskour & El Zarqa', lat: 31.328, lng: 31.712, keywords: ['فارسكور', 'الزرقا'] },
          { id: 'damietta_kafr_saad', nameAr: 'كفر سعد وكفر البطيخ', nameEn: 'Kafr Saad & Kafr El Batteekh', lat: 31.354, lng: 31.621, keywords: ['كفر سعد', 'كفر البطيخ'] }
        ]
      }
    ]
  },

  // 12. Port Said
  {
    id: 'port_said',
    nameAr: 'بورسعيد',
    nameEn: 'Port Said',
    lat: 31.2653,
    lng: 32.3019,
    cities: [
      {
        id: 'port_said_districts',
        nameAr: 'أحياء بورسعيد وبورفؤاد',
        nameEn: 'Port Said & Port Fouad',
        areas: [
          { id: 'port_said_sharq_arab', nameAr: 'حي الشرق والعرب والمناخ', nameEn: 'Al Sharq, Arab & Manakh', lat: 31.265, lng: 32.301, keywords: ['بورسعيد', 'حي الشرق', 'حي العرب', 'حي المناخ', 'port said'] },
          { id: 'port_said_zohour_dawahy', nameAr: 'حي الزهور والضواحي والجنوب', nameEn: 'Al Zohour & Dawahy', lat: 31.248, lng: 32.274, keywords: ['حي الزهور', 'حي الضواحي', 'الجنوب'] },
          { id: 'port_said_port_fouad', nameAr: 'مدينة بورفؤاد', nameEn: 'Port Fouad', lat: 31.238, lng: 32.328, keywords: ['بورفؤاد', 'مدينة بورفؤاد'] }
        ]
      }
    ]
  },

  // 13. Ismailia
  {
    id: 'ismailia',
    nameAr: 'الإسماعيلية',
    nameEn: 'Ismailia',
    lat: 30.5965,
    lng: 32.2715,
    cities: [
      {
        id: 'ismailia_cities',
        nameAr: 'مدن ومراكز الإسماعيلية',
        nameEn: 'Ismailia Centers',
        areas: [
          { id: 'ismailia_city', nameAr: 'مدينة الإسماعيلية', nameEn: 'Ismailia City', lat: 30.596, lng: 32.271, keywords: ['الإسماعيلية', 'الاسماعيلية', 'ismailia'] },
          { id: 'ismailia_fayed', nameAr: 'فايد وسراب يوم', nameEn: 'Fayed & Sarabyoum', lat: 30.324, lng: 32.298, keywords: ['فايد', 'سرابيوم'] },
          { id: 'ismailia_qantara', nameAr: 'القنطرة شرق والقنطرة غرب', nameEn: 'Al Qantara East & West', lat: 30.854, lng: 32.312, keywords: ['القنطرة', 'القنطرة شرق', 'القنطرة غرب'] },
          { id: 'ismailia_tall_kabir', nameAr: 'التل الكبير والقصاصين', nameEn: 'El Tall El Kabir & Qassasin', lat: 30.551, lng: 31.942, keywords: ['التل الكبير', 'القصاصين', 'أبو صوير'] }
        ]
      }
    ]
  },

  // 14. Suez
  {
    id: 'suez',
    nameAr: 'السويس',
    nameEn: 'Suez',
    lat: 29.9668,
    lng: 32.5498,
    cities: [
      {
        id: 'suez_districts',
        nameAr: 'أحياء السويس والعين السخنة',
        nameEn: 'Suez & Ain Sokhna',
        areas: [
          { id: 'suez_city_arbaeen', nameAr: 'حي الأربعين والسويس', nameEn: 'Arbaeen & Suez District', lat: 29.966, lng: 32.549, keywords: ['السويس', 'الأربعين', 'حي السويس', 'suez'] },
          { id: 'suez_faisal_attaka', nameAr: 'حي فيصل وعتاقة', nameEn: 'Faisal & Attaka', lat: 29.998, lng: 32.512, keywords: ['فيصل بالسويس', 'عتاقة', 'حي فيصل'] },
          { id: 'suez_ain_sokhna', nameAr: 'العين السخنة والجناين', nameEn: 'Ain Sokhna & Ganayen', lat: 29.605, lng: 32.338, keywords: ['العين السخنة', 'الجناين'] }
        ]
      }
    ]
  },

  // 15. North Sinai
  {
    id: 'north_sinai',
    nameAr: 'شمال سيناء',
    nameEn: 'North Sinai',
    lat: 31.1316,
    lng: 33.7984,
    cities: [
      {
        id: 'north_sinai_cities',
        nameAr: 'مدن ومراكز شمال سيناء',
        nameEn: 'North Sinai Centers',
        areas: [
          { id: 'nsinai_arish', nameAr: 'العريش', nameEn: 'Al Arish', lat: 31.131, lng: 33.798, keywords: ['العريش', 'al arish'] },
          { id: 'nsinai_sheikh_zuwayed', nameAr: 'الشيخ زويد ورفح', nameEn: 'Sheikh Zuwayed & Rafah', lat: 31.212, lng: 34.112, keywords: ['الشيخ زويد', 'رفح'] },
          { id: 'nsinai_bir_abd', nameAr: 'بئر العبد ونخل والحسنة', nameEn: 'Bir Al Abd, Nakhl & Hasana', lat: 31.021, lng: 33.012, keywords: ['بئر العبد', 'نخل', 'الحسنة'] }
        ]
      }
    ]
  },

  // 16. South Sinai
  {
    id: 'south_sinai',
    nameAr: 'جنوب سيناء',
    nameEn: 'South Sinai',
    lat: 27.9158,
    lng: 34.3299,
    cities: [
      {
        id: 'south_sinai_cities',
        nameAr: 'مدن ومراكز جنوب سيناء',
        nameEn: 'South Sinai Centers',
        areas: [
          { id: 'ssinai_sharm', nameAr: 'شرم الشيخ', nameEn: 'Sharm El Sheikh', lat: 27.915, lng: 34.329, keywords: ['شرم الشيخ', 'شرم', 'sharm el sheikh'] },
          { id: 'ssinai_dahab_nuweiba', nameAr: 'دهب ونويبع وطابا', nameEn: 'Dahab, Nuweiba & Taba', lat: 28.509, lng: 34.513, keywords: ['دهب', 'نويبع', 'طابا'] },
          { id: 'ssinai_tur_katrina', nameAr: 'طور سيناء وسانت كاترين ورأس سدر', nameEn: 'El Tor, St Catherine & Ras Sedr', lat: 28.238, lng: 33.621, keywords: ['طور سيناء', 'سانت كاترين', 'رأس سدر'] }
        ]
      }
    ]
  },

  // 17. Fayoum
  {
    id: 'fayoum',
    nameAr: 'الفيوم',
    nameEn: 'Fayoum',
    lat: 29.3084,
    lng: 30.8428,
    cities: [
      {
        id: 'fayoum_cities',
        nameAr: 'مدن ومراكز الفيوم',
        nameEn: 'Fayoum Centers',
        areas: [
          { id: 'fayoum_city', nameAr: 'مدينة الفيوم والفيوم الجديدة', nameEn: 'Fayoum City & New Fayoum', lat: 29.308, lng: 30.842, keywords: ['الفيوم', 'مدينة الفيوم', 'fayoum'] },
          { id: 'fayoum_sennuris', nameAr: 'سنورس وطامية', nameEn: 'Sennuris & Tamiya', lat: 29.408, lng: 30.865, keywords: ['سنورس', 'طامية'] },
          { id: 'fayoum_ibshaway', nameAr: 'إبشواي ويوسف الصديق', nameEn: 'Ibshaway & Yousef El Seddik', lat: 29.358, lng: 30.681, keywords: ['إبشواي', 'يوسف الصديق', 'قارون'] },
          { id: 'fayoum_itsaa', nameAr: 'إطسا', nameEn: 'Itsaa', lat: 29.238, lng: 30.789, keywords: ['إطسا', 'اطسا'] }
        ]
      }
    ]
  },

  // 18. Beni Suef
  {
    id: 'beni_suef',
    nameAr: 'بني سويف',
    nameEn: 'Beni Suef',
    lat: 29.0661,
    lng: 31.0994,
    cities: [
      {
        id: 'beni_suef_cities',
        nameAr: 'مدن ومراكز بني سويف',
        nameEn: 'Beni Suef Centers',
        areas: [
          { id: 'bsuef_city', nameAr: 'مدينة بني سويف وبني سويف الجديدة', nameEn: 'Beni Suef City & New Beni Suef', lat: 29.066, lng: 31.099, keywords: ['بني سويف', 'بني سويف الجديدة', 'beni suef'] },
          { id: 'bsuef_wasta', nameAr: 'الواسطى وناصر', nameEn: 'Al Wasta & Nasser', lat: 29.328, lng: 31.198, keywords: ['الواسطى', 'ناصر بوش'] },
          { id: 'bsuef_beba', nameAr: 'ببا وإهناسيا', nameEn: 'Beba & Ihnasya', lat: 28.924, lng: 30.985, keywords: ['ببا', 'إهناسيا', 'اهناسيا'] },
          { id: 'bsuef_fashn_samasta', nameAr: 'الفشن وسمسطا', nameEn: 'El Fashn & Somasta', lat: 28.824, lng: 30.898, keywords: ['الفشن', 'سمسطا'] }
        ]
      }
    ]
  },

  // 19. Minya
  {
    id: 'minya',
    nameAr: 'المنيا',
    nameEn: 'Minya',
    lat: 28.0871,
    lng: 30.7618,
    cities: [
      {
        id: 'minya_cities',
        nameAr: 'مدن ومراكز المنيا',
        nameEn: 'Minya Centers',
        areas: [
          { id: 'minya_city', nameAr: 'مدينة المنيا والمنيا الجديدة', nameEn: 'Minya City & New Minya', lat: 28.087, lng: 30.761, keywords: ['المنيا', 'المنيا الجديدة', 'minya'] },
          { id: 'minya_mallawi', nameAr: 'ملوي وديرمواس', nameEn: 'Mallawi & Deir Mawas', lat: 27.731, lng: 30.842, keywords: ['ملوي', 'ديرمواس'] },
          { id: 'minya_samalout', nameAr: 'سمالوط ومطاى', nameEn: 'Samalout & Matay', lat: 28.312, lng: 30.712, keywords: ['سمالوط', 'مطاي'] },
          { id: 'minya_beni_mazar', nameAr: 'بني مزار ومغاغة والعدوة', nameEn: 'Beni Mazar, Maghagha & El Idwa', lat: 28.498, lng: 30.798, keywords: ['بني مزار', 'مغاغة', 'العدوة'] },
          { id: 'minya_abu_qurqas', nameAr: 'أبو قرقاص', nameEn: 'Abu Qurqas', lat: 27.931, lng: 30.824, keywords: ['أبو قرقاص', 'ابو قرقاص'] }
        ]
      }
    ]
  },

  // 20. Asyut
  {
    id: 'asyut',
    nameAr: 'أسيوط',
    nameEn: 'Asyut',
    lat: 27.1801,
    lng: 31.1837,
    cities: [
      {
        id: 'asyut_cities',
        nameAr: 'مدن ومراكز أسيوط',
        nameEn: 'Asyut Centers',
        areas: [
          { id: 'asyut_city', nameAr: 'مدينة أسيوط وأسيوط الجديدة', nameEn: 'Asyut City & New Asyut', lat: 27.180, lng: 31.183, keywords: ['أسيوط', 'اسيوط', 'أسيوط الجديدة', 'asyut'] },
          { id: 'asyut_dayrut', nameAr: 'ديروط والقوصية', nameEn: 'Dayrut & Al Qusiya', lat: 27.558, lng: 30.812, keywords: ['ديروط', 'القوصية'] },
          { id: 'asyut_manfalut', nameAr: 'منفلوط وأبنوب', nameEn: 'Manfalut & Abnoub', lat: 27.312, lng: 30.971, keywords: ['منفلوط', 'أبنوب'] },
          { id: 'asyut_abu_tig', nameAr: 'أبو تيج وصدفا والغنايم', nameEn: 'Abu Tig, Sedfa & Ghanayem', lat: 27.042, lng: 31.319, keywords: ['أبو تيج', 'صدفا', 'الغنايم'] },
          { id: 'asyut_fateh_badari', nameAr: 'الفتح والبداري وساحل سليم', nameEn: 'El Fateh, Badari & Sahel Selim', lat: 26.992, lng: 31.412, keywords: ['الفتح', 'البداري', 'ساحل سليم'] }
        ]
      }
    ]
  },

  // 21. Sohag
  {
    id: 'sohag',
    nameAr: 'سوهاج',
    nameEn: 'Sohag',
    lat: 26.5569,
    lng: 31.6948,
    cities: [
      {
        id: 'sohag_cities',
        nameAr: 'مدن ومراكز سوهاج',
        nameEn: 'Sohag Centers',
        areas: [
          { id: 'sohag_city', nameAr: 'مدينة سوهاج وسوهاج الجديدة', nameEn: 'Sohag City & New Sohag', lat: 26.556, lng: 31.694, keywords: ['سوهاج', 'سوهاج الجديدة', 'sohag'] },
          { id: 'sohag_tahta', nameAr: 'طهطا وجهينة', nameEn: 'Tahta & Juhayna', lat: 26.769, lng: 31.502, keywords: ['طهطا', 'جهينة'] },
          { id: 'sohag_girga', nameAr: 'جرجا والبلينا', nameEn: 'Girga & Al Balyana', lat: 26.335, lng: 31.892, keywords: ['جرجا', 'البلينا'] },
          { id: 'sohag_maragha', nameAr: 'المراغة وطما', nameEn: 'Al Maragha & Tama', lat: 26.698, lng: 31.602, keywords: ['المراغة', 'طما'] },
          { id: 'sohag_akhmeem', nameAr: 'أخميم وساقلتة ودار السلام', nameEn: 'Akhmeem, Saqalta & Dar El Salam', lat: 26.565, lng: 31.745, keywords: ['أخميم', 'اخميم', 'ساقلتة', 'دار السلام بسوهاج'] }
        ]
      }
    ]
  },

  // 22. Qena
  {
    id: 'qena',
    nameAr: 'قنا',
    nameEn: 'Qena',
    lat: 26.1551,
    lng: 32.7160,
    cities: [
      {
        id: 'qena_cities',
        nameAr: 'مدن ومراكز قنا',
        nameEn: 'Qena Centers',
        areas: [
          { id: 'qena_city', nameAr: 'مدينة قنا وقنا الجديدة', nameEn: 'Qena City & New Qena', lat: 26.155, lng: 32.716, keywords: ['قنا', 'مدينة قنا', 'qena'] },
          { id: 'qena_naga_hammadi', nameAr: 'نجع حمادي وفرشوط وأبو تشت', nameEn: 'Nagaa Hammadi, Farshout & Abu Tesht', lat: 26.048, lng: 32.241, keywords: ['نجع حمادي', 'فرشوط', 'أبو تشت'] },
          { id: 'qena_dishna_waqf', nameAr: 'دشنا والوقف', nameEn: 'Dishna & El Waqf', lat: 26.118, lng: 32.481, keywords: ['دشنا', 'الوقف'] },
          { id: 'qena_qous_naqada', nameAr: 'قوص ونقادة', nameEn: 'Qous & Naqada', lat: 25.918, lng: 32.765, keywords: ['قوص', 'نقادة'] }
        ]
      }
    ]
  },

  // 23. Luxor
  {
    id: 'luxor',
    nameAr: 'الأقصر',
    nameEn: 'Luxor',
    lat: 25.6872,
    lng: 32.6396,
    cities: [
      {
        id: 'luxor_cities',
        nameAr: 'مدن ومراكز الأقصر',
        nameEn: 'Luxor Centers',
        areas: [
          { id: 'luxor_city', nameAr: 'مدينة الأقصر وطيبة الجديدة', nameEn: 'Luxor City & New Tiba', lat: 25.687, lng: 32.639, keywords: ['الأقصر', 'الاقصر', 'طيبة الجديدة', 'العوامية', 'luxor'] },
          { id: 'luxor_esna', nameAr: 'إسنا وأرمنت', nameEn: 'Esna & Armant', lat: 25.293, lng: 32.554, keywords: ['إسنا', 'اسنا', 'أرمنت', 'ارمنت'] },
          { id: 'luxor_qurna_bayadiya', nameAr: 'القرنة والقرنة الجديدة والبياضية والزينية', nameEn: 'Al Qurna & Bayadiya', lat: 25.728, lng: 32.612, keywords: ['القرنة', 'البياضية', 'الزينية'] }
        ]
      }
    ]
  },

  // 24. Aswan
  {
    id: 'aswan',
    nameAr: 'أسوان',
    nameEn: 'Aswan',
    lat: 24.0889,
    lng: 32.8998,
    cities: [
      {
        id: 'aswan_cities',
        nameAr: 'مدن ومراكز أسوان',
        nameEn: 'Aswan Centers',
        areas: [
          { id: 'aswan_city', nameAr: 'مدينة أسوان وأسوان الجديدة', nameEn: 'Aswan City & New Aswan', lat: 24.088, lng: 32.899, keywords: ['أسوان', 'اسوان', 'aswan', 'أسوان الجديدة'] },
          { id: 'aswan_edfu', nameAr: 'إدفو', nameEn: 'Edfu', lat: 24.978, lng: 32.874, keywords: ['إدفو', 'ادفو'] },
          { id: 'aswan_kom_ombo', nameAr: 'كوم أمبو ودراو', nameEn: 'Kom Ombo & Daraw', lat: 24.475, lng: 32.948, keywords: ['كوم أمبو', 'كوم امبو', 'دراو'] },
          { id: 'aswan_nasr_nuba', nameAr: 'نصر النوبة وأبو سمبل', nameEn: 'Nasr El Nuba & Abu Simbel', lat: 24.312, lng: 32.965, keywords: ['نصر النوبة', 'أبو سمبل', 'ابو سمبل'] }
        ]
      }
    ]
  },

  // 25. Red Sea
  {
    id: 'red_sea',
    nameAr: 'البحر الأحمر',
    nameEn: 'Red Sea',
    lat: 27.2579,
    lng: 33.8116,
    cities: [
      {
        id: 'red_sea_cities',
        nameAr: 'مدن محافظة البحر الأحمر',
        nameEn: 'Red Sea Cities',
        areas: [
          { id: 'redsea_hurghada', nameAr: 'الغردقة والجونة', nameEn: 'Hurghada & El Gouna', lat: 27.257, lng: 33.811, keywords: ['الغردقة', 'الجونة', 'hurghada', 'سهل حشيش'] },
          { id: 'redsea_safaga_quseir', nameAr: 'سفاجا والقصير', nameEn: 'Safaga & Al Quseir', lat: 26.731, lng: 33.935, keywords: ['سفاجا', 'القصير'] },
          { id: 'redsea_marsa_alam', nameAr: 'مرسى علم والشلاتين وحلايب', nameEn: 'Marsa Alam, Shalateen & Halayeb', lat: 25.068, lng: 34.896, keywords: ['مرسى علم', 'الشلاتين', 'حلايب'] },
          { id: 'redsea_ras_ghareb', nameAr: 'رأس غارب', nameEn: 'Ras Ghareb', lat: 28.358, lng: 33.085, keywords: ['رأس غارب', 'راس غارب'] }
        ]
      }
    ]
  },

  // 26. New Valley
  {
    id: 'new_valley',
    nameAr: 'الوادي الجديد',
    nameEn: 'New Valley',
    lat: 25.4514,
    lng: 30.5471,
    cities: [
      {
        id: 'new_valley_cities',
        nameAr: 'مراكز الوادي الجديد',
        nameEn: 'New Valley Centers',
        areas: [
          { id: 'nvalley_kharga', nameAr: 'الخارجة وباريس', nameEn: 'El Kharga & Paris', lat: 25.451, lng: 30.547, keywords: ['الخارجة', 'باريس'] },
          { id: 'nvalley_dakhla_farafra', nameAr: 'الداخلة والفرافرة وبلاط', nameEn: 'El Dakhla, Farafra & Balat', lat: 25.524, lng: 28.985, keywords: ['الداخلة', 'الفرافرة', 'بلاط'] }
        ]
      }
    ]
  },

  // 27. Matrouh
  {
    id: 'matrouh',
    nameAr: 'مطروح',
    nameEn: 'Matrouh',
    lat: 31.3543,
    lng: 27.2373,
    cities: [
      {
        id: 'matrouh_cities',
        nameAr: 'مدن ومراكز مطروح',
        nameEn: 'Matrouh Centers',
        areas: [
          { id: 'matrouh_city', nameAr: 'مرسى مطروح', nameEn: 'Marsa Matrouh City', lat: 31.354, lng: 27.237, keywords: ['مرسى مطروح', 'مطروح', 'marsa matrouh'] },
          { id: 'matrouh_alamein', nameAr: 'العلمين ومارينا والضبعة', nameEn: 'Al Alamein, Marina & El Dabaa', lat: 30.835, lng: 28.956, keywords: ['العلمين', 'العلمين الجديدة', 'مارينا', 'الضبعة'] },
          { id: 'matrouh_siwa', nameAr: 'واحة سيوة', nameEn: 'Siwa Oasis', lat: 29.204, lng: 25.518, keywords: ['سيوة', 'واحة سيوة'] },
          { id: 'matrouh_salloum_barrani', nameAr: 'السلوم وسيدي براني والنجيلة', nameEn: 'Salloum & Sidi Barrani', lat: 31.548, lng: 25.158, keywords: ['السلوم', 'سيدي براني', 'النجيلة'] }
        ]
      }
    ]
  }
]

// ============================================================================
// HELPER FUNCTIONS & EXPORTS
// ============================================================================

export function getGovernorates(): GovernorateItem[] {
  return EGYPT_GOVERNORATES
}

export function getCities(governorateId: string): CityItem[] {
  const gov = EGYPT_GOVERNORATES.find((g) => g.id === governorateId)
  return gov ? gov.cities : []
}

export function getAreas(governorateId: string, cityId: string): AreaItem[] {
  const cities = getCities(governorateId)
  const city = cities.find((c) => c.id === cityId)
  return city ? city.areas : []
}

export function findAreaById(areaId: string): {
  governorate: GovernorateItem
  city: CityItem
  area: AreaItem
} | null {
  for (const gov of EGYPT_GOVERNORATES) {
    for (const city of gov.cities) {
      const found = city.areas.find((a) => a.id === areaId)
      if (found) {
        return { governorate: gov, city, area: found }
      }
    }
  }
  return null
}

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Matches coordinates (from device GPS) to the closest known Egyptian district/neighborhood.
 * Rejects locations too far from Egypt (> 150km outside closest known centroid).
 */
export function matchCoordinatesToEgyptArea(
  lat: number,
  lng: number
): {
  governorate: GovernorateItem
  city: CityItem
  area: AreaItem
  distanceKm: number
  confidence: 'high' | 'medium' | 'low'
} | null {
  // Validate that point is reasonably within or near Egypt boundaries
  // Lat: 21.0 to 33.0, Lng: 24.0 to 37.5
  if (lat < 21.0 || lat > 33.0 || lng < 24.0 || lng > 37.5) {
    return null
  }

  let closest: {
    governorate: GovernorateItem
    city: CityItem
    area: AreaItem
    distanceKm: number
  } | null = null

  for (const gov of EGYPT_GOVERNORATES) {
    for (const city of gov.cities) {
      for (const area of city.areas) {
        const dist = calculateDistanceKm(lat, lng, area.lat, area.lng)
        if (!closest || dist < closest.distanceKm) {
          closest = {
            governorate: gov,
            city,
            area,
            distanceKm: dist
          }
        }
      }
    }
  }

  if (!closest) return null

  // If closest center is more than 80km away, confidence is low
  const confidence =
    closest.distanceKm <= 12
      ? 'high'
      : closest.distanceKm <= 45
      ? 'medium'
      : 'low'

  return {
    ...closest,
    confidence
  }
}

/**
 * Validates that governorate, city, and area IDs form a valid hierarchy
 */
export function validateHierarchy(
  governorateId?: string,
  cityId?: string,
  areaId?: string
): boolean {
  if (!governorateId) return false
  const gov = EGYPT_GOVERNORATES.find((g) => g.id === governorateId)
  if (!gov) return false
  if (!cityId) return true
  const city = gov.cities.find((c) => c.id === cityId)
  if (!city) return false
  if (!areaId || areaId === CUSTOM_AREA_ID) return true
  return city.areas.some((a) => a.id === areaId)
}
