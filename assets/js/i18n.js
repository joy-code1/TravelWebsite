/* ==========================================================================
   Travosca — internationalisation (window.TravoscaI18n)
   English / Russian / Uzbek dictionary (~250 keys) plus helpers:

   - t(key, vars)          translate a key, {name} placeholder interpolation
   - field(item, name)     read item.i18n.<lang>.<name> with EN/base fallback
   - month(i)              localized month name (0 = "any month")
   - lang() / set(lang)    current language + setter (persists, re-applies)
   - apply(scope)          translate [data-i18n], [data-i18n-*] attributes
   - [data-lang-switch]    buttons are wired automatically

   The chosen language is stored in localStorage['travosca:lang'] and a
   `travosca:langchange` event is dispatched on document for pages that
   re-render dynamic content (home.js, packages.js, blog.js).
   ========================================================================== */
(function () {
  'use strict';

  var LANGS = ['en', 'ru', 'uz'];
  var STORAGE_KEY = 'travosca:lang';

  var DICT = {
    /* ------------------------------------------------------------- nav */
    'nav.home': ['Home', 'Главная', 'Bosh sahifa'],
    'nav.about': ['About us', 'О нас', 'Biz haqimizda'],
    'nav.packages': ['Packages', 'Пакеты', 'Paketlar'],
    'nav.blog': ['Blog', 'Блог', 'Blog'],
    'nav.contact': ['Contact', 'Контакты', 'Aloqa'],
    'nav.allPackages': ['All packages', 'Все пакеты', 'Barcha paketlar'],
    'nav.asia': ['Asia', 'Азия', 'Osiyo'],
    'nav.europe': ['Europe', 'Европа', 'Yevropa'],
    'nav.cheapest': ['Cheapest first', 'Сначала дешёвые', 'Arzonlari boshida'],
    'nav.tripsCount': ['{n} trips', '{n} поездок', '{n} sayohat'],
    'nav.fromPrice': ['from ${n}', 'от ${n}', '${n} dan boshlab'],
    'nav.planTrip': ['Plan my trip', 'Спланировать поездку', 'Sayohatni rejalash'],
    'nav.searchLabel': ['Search destinations', 'Поиск направлений', 'Yo‘nalishlarni qidirish'],
    'nav.openMenu': ['Open menu', 'Открыть меню', 'Menyuni ochish'],
    'nav.closeMenu': ['Close menu', 'Закрыть меню', 'Menyuni yopish'],
    'nav.skip': ['Skip to content', 'Перейти к содержимому', 'Mazmunga o‘tish'],
    'nav.langLabel': ['Language', 'Язык', 'Til'],
    'nav.mobilePackages': ['Packages', 'Пакеты', 'Paketlar'],

    /* --------------------------------------------------------- common */
    'common.viewTrip': ['View trip', 'Смотреть тур', 'Turni ko‘rish'],
    'common.learnMore': ['Learn more', 'Подробнее', 'Batafsil'],
    'common.readMore': ['Read more', 'Читать далее', 'Davomini o‘qish'],
    'common.exploreNow': ['Explore now', 'Подобрать', 'Tanlash'],
    'common.subscribe': ['Subscribe', 'Подписаться', 'Obuna bo‘lish'],
    'common.emailPlaceholder': ['Type your email here...', 'Введите ваш e-mail...', 'E-pochangizni kiriting...'],
    'common.close': ['Close', 'Закрыть', 'Yopish'],
    'common.perPerson': ['per person', 'за человека', 'har bir kishiga'],
    'common.daysUnit': ['days', 'дней', 'kun'],
    'common.reviewsUnit': ['reviews', 'отзывов', 'sharh'],
    'common.outOf5': ['out of 5', 'из 5', '5 tadan'],
    'common.from': ['from', 'от', 'dan boshlab'],
    'common.clear': ['Clear', 'Сбросить', 'Tozalash'],
    'common.clearFilters': ['Clear filters', 'Сбросить фильтры', 'Filtrlarni tozalash'],
    'common.seeAllPackages': ['See all packages', 'Все пакеты', 'Barcha paketlar'],
    'common.askPlanner': ['Ask a planner', 'Спросить планировщика', 'Mutaxassisdan so‘rash'],
    'common.travellers': ['Travellers', 'Путешественники', 'Sayohatchilar'],
    'common.travellerOne': ['1 traveller', '1 путешественник', '1 sayohatchi'],
    'common.travellersCount': ['{n} travellers', '{n} путешественников', '{n} sayohatchi'],
    'common.travellersPlus': ['6+ travellers', '6+ путешественников', '6+ sayohatchi'],
    'common.loading': ['Loading…', 'Загрузка…', 'Yuklanmoqda…'],
    'common.notFound': ['Nothing found', 'Ничего не найдено', 'Hech narsa topilmadi'],
    'common.offline': ['The Travosca backend is not reachable — running in local mode. Content comes from assets/js/data.js and forms confirm locally.', 'Бэкенд Travosca недоступен — работаем в локальном режиме. Контент берётся из assets/js/data.js, формы подтверждаются локально.', 'Travosca backendiga ulanib bo‘lmadi — mahalliy rejim. Kontent assets/js/data.js dan olinadi, shakllar mahalliy tasdiqlanadi.'],
    'common.required': ['Required', 'Обязательно', 'Majburiy'],
    'common.backHome': ['Back to home', 'На главную', 'Bosh sahifaga'],
    'common.popularPlaces': ['Popular places:', 'Популярные направления:', 'Mashhur yo‘nalishlar:'],
    'common.searchHint': ['Press Esc to close · Enter opens the first result', 'Нажмите Esc, чтобы закрыть · Enter открывает первый результат', 'Yopish uchun Esc · Enter birinchi natijani ochadi'],
    'common.searchEmpty': ['No destination matches “{q}”. Try Bali, Paris or Swiss.', 'Нет направлений по запросу «{q}». Попробуйте Bali, Paris или Swiss.', '«{q}» bo‘yicha yo‘nalish topilmadi. Bali, Parij yoki Alplarni sinab ko‘ring.'],
    'common.searchTry': ['Try “Bali”, “Paris” or “Alps”', 'Попробуйте «Bali», «Paris» или «Alps»', '«Bali», «Parij» yoki «Alps» deb sinab ko‘ring'],
    'common.searchResults': ['Search destinations', 'Поиск направлений', 'Yo‘nalishlarni qidirish'],

    /* ------------------------------------------------------------ home */
    'home.eyebrow': ['Explore the world', 'Исследуйте мир', 'Dunyoni kashf eting'],
    'home.heroTitle1': ['Make your', 'Пусть', 'Sayohatingiz'],
    'home.heroEm': ['journey', 'путешествие', 'sayohatingiz'],
    'home.heroTitle2': [' effortless.', ' будет лёгким.', ' oson bo‘lsin.'],
    'home.heroLead': ['Small groups, handpicked hotels and local guides who know the road. Pick a place — we take care of the rest.', 'Небольшие группы, отборные отели и местные гиды, знающие дорогу. Выберите место — остальное возьмём на себя.', 'Kichik guruhlar, tanlangan mehmonxonalar va yo‘lni yaxshi biladigan mahalliy yo‘lboshchilar. Joyini tanlang — qolganini biz hal qilamiz.'],
    'home.whereTo': ['Where to?', 'Куда?', 'Qayerga?'],
    'home.anyMonth': ['Any month', 'Любой месяц', 'Har qanday oy'],
    'home.when': ['When', 'Когда', 'Qachon'],
    'home.destEyebrow': ['Popular right now', 'Популярно сейчас', 'Hozir mashhur'],
    'home.destTitle': ['Explore new worlds with exotic natural scenery', 'Открывайте новые миры с экзотической природой', 'Ekzotik tabiatli yangi dunyolarni kashf eting'],
    'home.destLead': ['Seven trips our travellers keep coming back to — beaches, mountains and cities that stay with you.', 'Семь поездок, куда наши путешественники возвращаются снова, — пляжи, горы и города, которые остаются с вами.', 'Sayohatchilarimiz qayta-qayta qaytadigan yetti sayohat — siz bilan qoladigan plajlar, tog‘lar va shaharlar.'],
    'home.tripsUpdated': ['trips · updated weekly', 'поездок · обновляется еженедельно', 'sayohat · har hafta yangilanadi'],
    'home.whyEyebrow': ['Why choose us?', 'Почему мы?', 'Nega aynan biz?'],
    'home.whyTitle': ['Our services have been trusted by world travellers', 'Наши услуги выбирают путешественники со всего мира', 'Xizmatlarimizga butun dunyo sayohatchilari ishonadi'],
    'home.whyLead': ['No call centres, no surprises — just a small team that plans trips the way it would plan its own.', 'Никаких колл-центров и сюрпризов — только небольшая команда, которая планирует поездки как для себя.', 'Kol-markaz va kutilmagan holatlar yo‘q — sayohatlarni o‘zlari uchun rejalashtiradigan kichik jamoa.'],
    'home.partnersEyebrow': ['Trusted by', 'Нам доверяют', 'Bizga ishonishadi'],
    'home.partnersTitle': ['Our tour partner', 'Наши партнёры', 'Bizning hamkorlar'],
    'home.partnersLead': ['We book through partners we have worked with for years, so your payment and your plans stay protected.', 'Мы бронируем через партнёров, с которыми работаем много лет, поэтому ваша оплата и ваши планы защищены.', 'Biz ko‘p yillardan beri hamkorlik qiladigan hamkorlar orqali bron qilamiz — to‘lovingiz va rejalaringiz himoyada.'],
    'home.testiEyebrow': ['Testimonial', 'Отзывы', 'Fikrlar'],
    'home.testiTitle': ['What our client say', 'Что говорят наши клиенты', 'Mijozlarimiz nima deydi'],
    'home.testiLead': ['Real words from travellers who came home already planning the next one.', 'Настоящие слова путешественников, которые вернулись домой, уже планируя следующую поездку.', 'Uyga qaytib, keyingi sayohatni rejalashtirayotgan sayohatchilarning haqiqiy so‘zlari.'],
    'home.ctaEyebrow': ['Ready when you are', 'Готовы, когда вы', 'Siz tayyor bo‘lganingizda'],
    'home.ctaTitle': ['Tell us the mood. We will find the place.', 'Скажите настроение. Мы найдём место.', 'Kayfiyatingizni ayting. Biz joyini topamiz.'],
    'home.ctaText': ['Six questions, one short call and a draft itinerary in your inbox within 48 hours.', 'Шесть вопросов, один короткий звонок — и черновик маршрута у вас на почте в течение 48 часов.', 'Oltita savol, qisqa suhbat — va 48 soat ichida marshrut loyihasi pochtangizda.'],
    'home.ctaStart': ['Start planning', 'Начать планирование', 'Rejalashtirishni boshlash'],
    'home.ctaBrowse': ['Browse packages', 'Смотреть пакеты', 'Paketlarni ko‘rish'],
    'home.ctaMeetTeam': ['Meet the team', 'Познакомиться с командой', 'Jamoa bilan tanishish'],
    'home.noscript': ['JavaScript is switched off, so the live trip list cannot load. Every package is still bookable — ask a planner and we will send the current catalogue.', 'JavaScript выключен, поэтому живой список туров не загрузится. Забронировать пакет всё равно можно — напишите планировщику, и мы пришлём каталог.', 'JavaScript o‘chirilgan, jonli ro‘yxat yuklanmaydi. Paketni baribir bron qilish mumkin — mutaxassisga yozing, katalogni yuboramiz.'],

    /* ------------------------------------------------------- packages */
    'pkg.heroTitle': ['Travel packages', 'Пакеты туров', 'Tur paketlari'],
    'pkg.heroSub': ['Seven hand-built itineraries, ready to book or to tweak with a planner.', 'Семь авторских маршрутов: бронируйте как есть или доработайте с планировщиком.', 'Yettita muallif marshruti: xuddi shunday bron qiling yoki mutaxassis bilan moslashtiring.'],
    'pkg.eyebrow': ['Popular destination', 'Популярные направления', 'Mashhur yo‘nalishlar'],
    'pkg.title': ['Find the trip that fits your week off', 'Найдите поездку под ваш отпуск', 'Ta’tilingizga mos sayohatni toping'],
    'pkg.lead': ['Filter by region, sort by price or rating, and search by name. Every price below is per person and includes guiding, stays and transfers.', 'Фильтруйте по региону, сортируйте по цене или рейтингу, ищите по названию. Каждая цена указана за человека и включает гида, проживание и трансферы.', 'Hudud bo‘yicha filtrlash, narx yoki reyting bo‘yicha saralash, nomi bo‘yicha qidirish. Har bir narx har bir kishiga hisoblanadi va yo‘lboshchi, turar joy va transferlarni o‘z ichiga oladi.'],
    'pkg.searchPlaceholder': ['Search packages…', 'Поиск пакетов…', 'Paketlarni qidirish…'],
    'pkg.searchLabel': ['Search packages', 'Поиск пакетов', 'Paketlarni qidirish'],
    'pkg.sortLabel': ['Sort packages', 'Сортировка пакетов', 'Paketlarni saralash'],
    'pkg.sortPopular': ['Most popular', 'Самые популярные', 'Eng mashhurlari'],
    'pkg.sortPriceAsc': ['Price: low to high', 'Цена: по возрастанию', 'Narx: arzondan qimmatga'],
    'pkg.sortPriceDesc': ['Price: high to low', 'Цена: по убыванию', 'Narx: qimmatdan arzonga'],
    'pkg.sortRating': ['Highest rated', 'Высокий рейтинг', 'Yuqori reyting'],
    'pkg.sortDays': ['Shortest trip', 'Короткие поездки', 'Qisqa sayohatlar'],
    'pkg.filterAll': ['All regions', 'Все регионы', 'Barcha hududlar'],
    'pkg.filterLabel': ['Filter by region', 'Фильтр по региону', 'Hudud bo‘yicha filtr'],
    'pkg.matches': ['trips match your search', 'поездок найдено по вашему запросу', 'sayohat so‘rovingizga mos keldi'],
    'pkg.emptyTitle': ['Nothing matches that search', 'Ничего не найдено', 'Bu so‘rovga hech narsa mos emas'],
    'pkg.emptyText': ['Try a different spelling, or clear the filters to see all seven trips.', 'Попробуйте другое написание или сбросьте фильтры, чтобы увидеть все семь поездок.', 'Boshqa imlo bilan sinab ko‘ring yoki barcha yetti sayohatni ko‘rish uchun filtrlarni tozalang.'],
    'pkg.readEyebrow': ['Tips & article', 'Советы и статьи', 'Maslahat va maqolalar'],
    'pkg.readTitle': ['Read before you book', 'Прочитайте перед бронью', 'Bron qilishdan oldin o‘qing'],
    'pkg.readLead': ['Short, practical pieces from the people who plan the trips.', 'Короткие практичные заметки от тех, кто планирует поездки.', 'Sayohatlarni rejalashtiruvchilardan qisqa va foydali maqolalar.'],
    'pkg.notSure': ['Not sure where to go?', 'Не знаете, куда поехать?', 'Qayerga borishni bilmayapsizmi?'],
    'pkg.contextTravelling': ['Travelling in', 'Поездка в', 'Sayohat oyi'],
    'pkg.contextLooking': ['Looking at', 'Вы смотрите', 'Ko‘rilmoqda'],

    /* --------------------------------------------------------- booking */
    'book.eyebrow': ['Almost there', 'Почти готово', 'Deyarli tayyor'],
    'book.title': ['Book this trip', 'Забронировать тур', 'Bu turni bron qilish'],
    'book.lead': ['We hold your place for 24 hours while a planner confirms the details by email. No payment is taken now.', 'Мы держим место 24 часа, пока планировщик подтверждает детали по почте. Оплата сейчас не списывается.', 'Joyingizni 24 soat ushlab turamiz — mutaxassis detallarni e-pochta orqali tasdiqlaydi. Hozir to‘lov olinmaydi.'],
    'book.name': ['Full name', 'Полное имя', 'To‘liq ism'],
    'book.email': ['Email', 'Эл. почта', 'Elektron pochta'],
    'book.date': ['Preferred date', 'Желаемая дата', 'Istalgan sana'],
    'book.submit': ['Request booking', 'Отправить заявку', 'Bron so‘rovi yuborish'],
    'book.payNow': ['Pay now', 'Оплатить сейчас', 'Hozir to‘lash'],
    'book.errName': ['Please tell us who is travelling.', 'Скажите, кто едет.', 'Kim sayohat qilishini ayting.'],
    'book.errEmail': ['We need a valid email to send your confirmation.', 'Нужен корректный e-mail для подтверждения.', 'Tasdiq uchun to‘g‘ri e-pochta kerak.'],
    'book.errDate': ['Pick the date you would like to fly.', 'Выберите дату вылета.', 'Uchish sanasini tanlang.'],
    'book.errCheck': ['Please check the highlighted fields.', 'Проверьте выделенные поля.', 'Belgilangan maydonlarni tekshiring.'],
    'book.localTitle': ['Request sent 🎉', 'Заявка отправлена 🎉', 'So‘rov yuborildi 🎉'],
    'book.localText': ['Thanks {name} — we have your request for {trip} on {date}. A planner will email {email} within 24 hours.', 'Спасибо, {name}! Заявка на «{trip}» на {date} получена. В течение 24 часов планировщик напишет на {email}.', 'Rahmat, {name}! {trip} bo‘yicha {date} uchun so‘rovingiz qabul qilindi. 24 soat ichida mutaxassis {email} ga yozadi.'],
    'book.toastLocal': ['Booking request sent. We will be in touch shortly.', 'Заявка отправлена. Скоро свяжемся.', 'So‘rov yuborildi. Tez orada bog‘lanamiz.'],
    'book.savedTitle': ['Booking saved 🎉', 'Бронь сохранена 🎉', 'Bron saqlandi 🎉'],
    'book.savedRef': ['Your booking reference', 'Номер вашей брони', 'Broningiz raqami'],
    'book.total': ['Total', 'Итого', 'Jami'],
    'book.status': ['Status', 'Статус', 'Holat'],
    'book.lookupHint': ['Keep the reference: you can check this booking any time with the reference and your e-mail.', 'Сохраните номер: бронь можно проверить в любой момент по номеру и вашему e-mail.', 'Raqamni saqlang: bronni raqam va e-pochtangiz orqali har qanday vaqtda tekshirish mumkin.'],
    'book.toastSaved': ['Booking created on the server.', 'Бронь создана на сервере.', 'Bron serverda yaratildi.'],
    'book.lastTitle': ['Your recent booking', 'Ваша последняя бронь', 'Oxirgi broningiz'],
    'book.lastEmpty': ['No booking on this device yet.', 'На этом устройстве броней пока нет.', 'Bu qurilmada hali bron yo‘q.'],
    'book.goCheckout': ['Continue to payment', 'Перейти к оплате', 'To‘lovga o‘tish'],
    'book.dismiss': ['Dismiss', 'Скрыть', 'Yashirish'],
    'book.tripLabel': ['Trip', 'Тур', 'Tur'],
    'book.dateLabel': ['Date', 'Дата', 'Sana'],
    'book.peopleLabel': ['People', 'Люди', 'Odamlar'],
    'book.savedOfflineNote': ['Saved locally (no server) — start the Node server to get a real booking reference.', 'Сохранено локально (без сервера) — запустите Node-сервер, чтобы получить настоящий номер брони.', 'Mahalliy saqlandi (server yo‘q) — haqiqiy bron raqami uchun Node serverni ishga tushiring.'],

    /* ------------------------------------------------------------ about */
    'about.heroTitle': ['About us', 'О нас', 'Biz haqimizda'],
    'about.heroSub': ['A small team of planners, guides and fixers who would rather travel slowly.', 'Небольшая команда планировщиков, гидов и «фиксеров», которые предпочитают путешествовать неспешно.', 'Sekin sayohat qilishni afzal ko‘radigan planlovchilar, yo‘lboshchilar va tashkilotchilarning kichik jamoasi.'],
    'about.value1Title': ['Great teamwork', 'Отличная командная работа', 'Ajoyib jamoa ishi'],
    'about.value1Text': ['Planners, local guides and drivers who have worked together for years, so a trip runs the way it was designed on the day.', 'Планировщики, местные гиды и водители работают вместе много лет, поэтому поездка идёт по замыслу.', 'Planlovchilar, mahalliy yo‘lboshchilar va haydovchilar ko‘p yillardan beri birga ishlaydi — sayohat reja bo‘yincha kechadi.'],
    'about.value2Title': ['Our vision', 'Наше видение', 'Bizning qarashimiz'],
    'about.value2Text': ['Travel that gives more than it takes: small groups, locally owned stays and itineraries paced for the place, not the checklist.', 'Путешествия, которые отдают больше, чем берут: маленькие группы, местное проживание и ритм, подстроенный под место, а не под чек-лист.', 'Olganidan ko‘p narsa beradigan sayohat: kichik guruhlar, mahalliy turar joy va joy uchun moslashtirilgan, ro‘yxat uchun emas.'],
    'about.value3Title': ['Our mission', 'Наша миссия', 'Bizning vazifamiz'],
    'about.value3Text': ['To make a properly planned trip something anyone can book — honest prices, no hidden transfers and a real person on the other end.', 'Сделать хорошо спланированное путешествие доступным каждому: честные цены, без скрытых трансферов и с живым человеком на связи.', 'To‘g‘ri rejalashtirilgan sayohatni har kim bron qiladigan qilish: halol narxlar, yashirin transferlarsiz va uchida haqiqiy odam.'],
    'about.storyEyebrow': ['Our story', 'Наша история', 'Bizning tariximiz'],
    'about.storyTitle': ['We started with one badly planned holiday', 'Всё началось с одного плохо спланированного отпуска', 'Hammasi yomon rejalashtirilgan bir ta’tildan boshlandi'],
    'about.quote': ['A good trip is not a longer checklist. It is one place seen properly.', 'Хорошая поездка — не длинный чек-лист. Это одно место, увиденное как следует.', 'Yaxshi sayohat — uzun ro‘yxat emas. Bu — to‘g‘ri ko‘rilgan bitta joy.'],
    'about.founderRole': ['Founder, Travosca', 'Основатель, Travosca', 'Asoschi, Travosca'],
    'about.statsEyebrow': ['By the numbers', 'Цифры', 'Raqamlarda'],
    'about.statsTitle': ['Ten years of small groups', 'Десять лет маленьких групп', 'Kichik guruhlarning o‘n yili'],
    'about.stat1': ['Satisfied clients', 'Довольных клиентов', 'Mamnun mijozlar'],
    'about.stat2': ['New travellers', 'Новых путешественников', 'Yangi sayohatchilar'],
    'about.stat3': ['Destinations', 'Направлений', 'Yo‘nalishlar'],
    'about.stat4': ['Awards', 'Наград', 'Mukofotlar'],
    'about.galleryEyebrow': ['Gallery', 'Галерея', 'Galereya'],
    'about.galleryTitle': ['Unforgettable moments', 'Незабываемые моменты', 'Unutilmas lahzalar'],
    'about.galleryLead': ['Frames from trips we have run — no stock photography, no filters.', 'Кадры из наших же поездок — без стоковых фото и без фильтров.', 'Biz o‘tkazgan sayohatlardan kadrlar — stok suratlar va filtrlarsiz.'],

    /* ---------------------------------------------------------- contact */
    'contact.heroTitle': ['Contact', 'Контакты', 'Aloqa'],
    'contact.heroSub': ['Tell us where you want to go. We usually answer within one working day.', 'Расскажите, куда хотите поехать. Обычно отвечаем в течение одного рабочего дня.', 'Qayerga borishni xohlayotganingizni ayting. Odatda bir ish kuni ichida javob beramiz.'],
    'contact.eyebrow': ['Send a message', 'Отправить сообщение', 'Xabar yuborish'],
    'contact.title': ['Get in touch', 'Связаться с нами', 'Bog‘lanish'],
    'contact.lead': ['Fill in the form and a planner will reply with ideas, dates and a rough price. No newsletter signup, no sales call.', 'Заполните форму — планировщик ответит с идеями, датами и примерной ценой. Без рассылок и продажных звонков.', 'Shaklni to‘ldiring — mutaxassis g‘oyalar, sanalar va taxminiy narx bilan javob beradi. Spam va sotuv qo‘ng‘iroqlarisiz.'],
    'contact.name': ['Your name', 'Ваше имя', 'Ismingiz'],
    'contact.email': ['Your email', 'Ваш e-mail', 'E-pochtangiz'],
    'contact.destination': ['Where do you want to go?', 'Куда вы хотите поехать?', 'Qayerga bormoqchisiz?'],
    'contact.notSureYet': ['Not sure yet', 'Ещё не решил', 'Hali aniq emas'],
    'contact.subject': ['Subject', 'Тема', 'Mavzu'],
    'contact.message': ['Your message', 'Ваше сообщение', 'Xabaringiz'],
    'contact.submit': ['Send message', 'Отправить сообщение', 'Xabar yuborish'],
    'contact.errName': ['Please tell us your name.', 'Представьтесь, пожалуйста.', 'Ismingizni ayting.'],
    'contact.errEmail': ['We need a valid email to reply to.', 'Нужен корректный e-mail для ответа.', 'Javob berish uchun to‘g‘ri e-pochta kerak.'],
    'contact.errMessage': ['A few more words helps us plan better — 20 characters minimum.', 'Напишите чуть подробнее — минимум 20 символов.', 'Bir oz batafsil yozing — kamida 20 belgi.'],
    'contact.ok': ['Thanks {name}! Your message is with a planner — expect a reply within one working day.', 'Спасибо, {name}! Сообщение у планировщика — ответ в течение одного рабочего дня.', 'Rahmat, {name}! Xabaringiz mutaxassisda — bir ish kuni ichida javob kuting.'],
    'contact.officesTitle': ['Our offices', 'Наши офисы', 'Bizning ofislarimiz'],
    'contact.faqTitle': ['Frequently asked', 'Частые вопросы', 'Ko‘p so‘raladigan savollar'],
    'contact.faq1': ['How far in advance should I book?', 'За сколько дней заранее бронировать?', 'Qancha oldin bron qilish kerak?'],
    'contact.faq2': ['Can you tailor a package?', 'Можно изменить пакет под меня?', 'Paketni o‘zimga moslashtira olasizmi?'],
    'contact.faq3': ['What is included in the price?', 'Что входит в цену?', 'Narxga nima kiradi?'],
    'contact.faq4': ['How does the price guarantee work?', 'Как работает гарантия цены?', 'Narx kafolati qanday ishlaydi?'],

    /* ------------------------------------------------------------- blog */
    'blog.recentTitle': ['Recent post', 'Свежие посты', 'So‘nggi yozuvlar'],
    'blog.categoriesTitle': ['Categories', 'Категории', 'Kategoriyalar'],
    'blog.catTravel': ['Travel', 'Путешествия', 'Sayohat'],
    'blog.catTips': ['Tips', 'Советы', 'Maslahatlar'],
    'blog.catStories': ['Stories', 'Истории', 'Hikoyalar'],
    'blog.catDestination': ['Destination', 'Направления', 'Yo‘nalishlar'],
    'blog.questionTitle': ['Have any questions?', 'Есть вопросы?', 'Savollaringiz bormi?'],
    'blog.questionText': ['Do not hesitate to give us a call. We are an expert team and we are happy to talk to you.', 'Звоните без колебаний — мы команда экспертов и рады поговорить.', 'Ikkilanmay qo‘ng‘iroq qiling. Biz professional jamoamiz va siz bilan gaplashishdan xursandmiz.'],
    'blog.commentsTitle': ['Leave a reply', 'Оставить комментарий', 'Fikr qoldiring'],
    'blog.commentsCount': ['comments', 'комментариев', 'sharh'],
    'blog.commentsNote': ['Your email address will not be published. Required fields are marked *', 'Ваш e-mail не будет опубликован. Обязательные поля отмечены *', 'E-pochtangiz chop etilmaydi. Majburiy maydonlar * bilan belgilangan'],
    'blog.commentLabel': ['Comment', 'Комментарий', 'Fikr'],
    'blog.nameLabel': ['Name', 'Имя', 'Ism'],
    'blog.emailLabel': ['Email', 'Эл. почта', 'Elektron pochta'],
    'blog.remember': ['Save my name, email, and website in this browser for the next time I comment.', 'Сохранить имя, e-mail и сайт в этом браузере для следующих комментариев.', 'Keyingi fikr uchun ism, e-pochta va saytni brauzerda saqlash.'],
    'blog.submit': ['Post comment', 'Отправить комментарий', 'Fikr yuborish'],
    'blog.errComment': ['Tell us a little more — 10 characters minimum.', 'Напишите чуть подробнее — минимум 10 символов.', 'Bir oz ko‘proq yozing — kamida 10 belgi.'],
    'blog.errName': ['Please add your name.', 'Укажите имя.', 'Ismingizni kiriting.'],
    'blog.errEmail': ['We need a valid email.', 'Нужен корректный e-mail.', 'To‘g‘ri e-pochta kerak.'],
    'blog.localMode': ['Stored in this browser (no server).', 'Сохранено в этом браузере (без сервера).', 'Bu brauzerda saqlandi (serversiz).'],
    'blog.serverMode': ['Saved on the server.', 'Сохранено на сервере.', 'Serverda saqlandi.'],
    'blog.copyLink': ['Copy link', 'Скопировать ссылку', 'Havolani nusxalash'],
    'blog.copied': ['Link copied!', 'Ссылка скопирована!', 'Havola nusxalandi!'],

    /* ----------------------------------------------------------- footer */
    'footer.about': ['Small-group trips, handpicked stays and guides who actually live where they lead. Travosca has been planning journeys since 2016.', 'Небольшие группы, отборное жильё и гиды, которые действительно живут там, где водят. Travosca планирует путешествия с 2016 года.', 'Kichik guruhlar, tanlangan turar joy va yo‘lboshchilik qilgan joyda haqiqatan yashovchi yo‘lboshchilar. Travosca 2016-yildan beri sayohatlarni rejalashtiradi.'],
    'footer.quickLinks': ['Quick links', 'Быстрые ссылки', 'Tezkor havolalar'],
    'footer.popularTrips': ['Popular trips', 'Популярные туры', 'Mashhur turlar'],
    'footer.contactInfo': ['Contact information', 'Контактная информация', 'Aloqa ma’lumotlari'],
    'footer.rights': ['© {year} Travosca. All rights reserved.', '© {year} Travosca. Все права защищены.', '© {year} Travosca. Barcha huquqlar himoyalangan.'],
    'footer.rightsSuffix': ['Travosca. All rights reserved.', 'Travosca. Все права защищены.', 'Travosca. Barcha huquqlar himoyalangan.'],
    'footer.privacy': ['Privacy policy', 'Политика конфиденциальности', 'Maxfiylik siyosati'],
    'footer.terms': ['Terms of service', 'Условия использования', 'Xizmat shartlari'],
    'footer.cookies': ['Cookie settings', 'Настройки cookie', 'Cookie sozlamalari'],
    'footer.newsletterTitle': ['Subscribe to get special price', 'Подпишитесь, чтобы получить спеццену', 'Maxsus narx olish uchun obuna bo‘ling'],
    'footer.newsletterText': ['Don\u2019t want to miss something? Subscribe right now and get special promotion and monthly newsletter.', 'Не хотите ничего пропустить? Подпишитесь и получайте акции и ежемесячную рассылку.', 'Hech narsani o‘tkazib yubormaslik uchun hozir obuna bo‘ling: aksiyalar va oylik newsletter.'],
    'footer.newsletterOk': ['Thanks! Check your inbox — your first deal is on the way.', 'Спасибо! Проверьте почту — первое предложение уже в пути.', 'Rahmat! Pochtangizni tekshiring — birinchi taklif yo‘lda.'],
    'footer.newsletterErr': ['Please enter a valid email address.', 'Введите корректный e-mail.', 'To‘g‘ri e-pochta kiriting.'],
    'footer.newsletterToast': ['You are subscribed. Welcome aboard!', 'Вы подписаны. Добро пожаловать!', 'Siz obuna bo‘ldingiz. Xush kelibsiz!'],
    'footer.emailLabel': ['Your email address', 'Ваш e-mail', 'E-pochtangiz'],

    /* ---------------------------------------------------------- months */
    'month.0': ['Any month', 'Любой месяц', 'Har qanday oy'],
    'month.1': ['January', 'Январь', 'Yanvar'],
    'month.2': ['February', 'Февраль', 'Fevral'],
    'month.3': ['March', 'Март', 'Mart'],
    'month.4': ['April', 'Апрель', 'Aprel'],
    'month.5': ['May', 'Май', 'May'],
    'month.6': ['June', 'Июнь', 'Iyun'],
    'month.7': ['July', 'Июль', 'Iyul'],
    'month.8': ['August', 'Август', 'Avgust'],
    'month.9': ['September', 'Сентябрь', 'Sentabr'],
    'month.10': ['October', 'Октябрь', 'Oktabr'],
    'month.11': ['November', 'Ноябрь', 'Noyabr'],
    'month.12': ['December', 'Декабрь', 'Dekabr'],

    /* ----------------------------------------------------------- status */
    'status.pending': ['pending', 'ожидает оплаты', 'kutilmoqda'],
    'status.paid': ['paid', 'оплачено', 'to‘langan'],
    'status.cancelled': ['cancelled', 'отменено', 'bekor qilingan'],
    'status.completed': ['completed', 'завершено', 'tugallangan'],
    'status.checkout_created': ['awaiting payment', 'ожидает оплаты', 'to‘lov kutilmoqda'],
    'status.declined': ['payment declined', 'платёж отклонён', 'to‘lov rad etildi'],

    /* --------------------------------------------------------- checkout */
    'checkout.title': ['Checkout', 'Оплата', 'To‘lov'],
    'checkout.lead': ['Pay securely to confirm your booking.', 'Оплатите безопасно, чтобы подтвердить бронь.', 'Bronni tasdiqlash uchun xavfsiz to‘lang.'],
    'checkout.summary': ['Booking summary', 'Сводка брони', 'Bron ma’lumotlari'],
    'checkout.ref': ['Reference', 'Номер брони', 'Bron raqami'],
    'checkout.trip': ['Trip', 'Тур', 'Tur'],
    'checkout.date': ['Date', 'Дата', 'Sana'],
    'checkout.people': ['Travellers', 'Путешественники', 'Sayohatchilar'],
    'checkout.total': ['Total to pay', 'К оплате', 'To‘lov summasi'],
    'checkout.status': ['Status', 'Статус', 'Holat'],
    'checkout.session': ['Payment session', 'Платёжная сессия', 'To‘lov sessiyasi'],
    'checkout.cardNumber': ['Card number', 'Номер карты', 'Karta raqami'],
    'checkout.cardExpiry': ['Expiry (MM/YY)', 'Срок действия (ММ/ГГ)', 'Amal qilish muddati (OO/YY)'],
    'checkout.cardCvc': ['CVC', 'CVC', 'CVC'],
    'checkout.cardName': ['Name on card', 'Имя на карте', 'Kartadagi ism'],
    'checkout.pay': ['Pay ${total}', 'Оплатить ${total}', '${total} to‘lash'],
    'checkout.testCards': ['Test cards', 'Тестовые карты', 'Sinov kartalari'],
    'checkout.cardOkChip': ['4242 4242 4242 4242 — succeeds', '4242 4242 4242 4242 — успешная оплата', '4242 4242 4242 4242 — muvaffaqiyatli'],
    'checkout.cardBadChip': ['…0002 — declined', '…0002 — отклоняется', '…0002 — rad etiladi'],
    'checkout.successTitle': ['Payment received', 'Платёж получен', 'To‘lov qabul qilindi'],
    'checkout.successText': ['Booking {ref} is now paid. A confirmation has been queued for {email}.', 'Бронь {ref} оплачена. Подтверждение отправлено на {email}.', '{ref} bron to‘langan. Tasdiq {email} ga yuborildi.'],
    'checkout.declinedTitle': ['Card declined', 'Карта отклонена', 'Karta rad etildi'],
    'checkout.declinedText': ['The payment was declined and the booking stays pending. Try card 4242 4242 4242 4242.', 'Платёж отклонён, бронь остаётся в ожидании. Попробуйте карту 4242 4242 4242 4242.', 'To‘lov rad etildi, bron kutilmoqda. 4242 4242 4242 4242 kartasini sinab ko‘ring.'],
    'checkout.invalidCard': ['Enter a 16-digit card number.', 'Введите 16-значный номер карты.', '16 xonali karta raqamini kiriting.'],
    'checkout.offline': ['The payment API needs the Node server (npm start). Card data is never stored.', 'Для оплаты нужен Node-сервер (npm start). Данные карты не сохраняются.', 'To‘lov uchun Node server kerak (npm start). Karta ma’lumotlari saqlanmaydi.'],
    'checkout.notFound': ['Booking not found. Check the reference and the e-mail used for the booking.', 'Бронь не найдена. Проверьте номер и e-mail, указанный при бронировании.', 'Bron topilmadi. Bron paytida ko‘rsatilgan raqam va e-pochtani tekshiring.'],
    'checkout.howTitle': ['How to test this', 'Как это проверить', 'Buni qanday sinash kerak'],
    'checkout.how1': ['Start the backend: npm start (or PORT=8000 npm start) and open the site through http://localhost:4173.', 'Запустите бэкенд: npm start (или PORT=8000 npm start) и откройте сайт через http://localhost:4173.', 'Backendni ishga tushiring: npm start (yoki PORT=8000 npm start) va saytni http://localhost:4173 orqali oching.'],
    'checkout.how2': ['Book any trip on the Packages page — you will get a TRV-XXXXXX reference.', 'Забронируйте любой тур на странице Packages — вы получите номер TRV-XXXXXX.', 'Paketlar sahifasida biror turni bron qiling — TRV-XXXXXX raqamini olasiz.'],
    'checkout.how3': ['Pay with card 4242 4242 4242 4242 (success) or any card ending 0002 (declined, HTTP 402).', 'Оплатите картой 4242 4242 4242 4242 (успех) или любой картой, оканчивающейся на 0002 (отказ, HTTP 402).', '4242 4242 4242 4242 kartasi bilan to‘lang (muvaffaqiyat) yoki oxiri 0002 bo‘lgan karta (rad etish, HTTP 402).'],
    'checkout.how4': ['Check the booking with the reference + e-mail lookup or in /admin/ (Bookings tab).', 'Проверьте бронь по номеру + e-mail или в /admin/ (вкладка Bookings).', 'Bronni raqam + e-pochta orqali yoki /admin/ (Bookings bo‘limi) da tekshiring.'],
    'checkout.checkBtn': ['Check status', 'Проверить статус', 'Holatni tekshirish'],
    'checkout.emailLabel': ['E-mail used for the booking', 'E-mail, указанный при бронировании', 'Bron uchun ko‘rsatilgan e-pochta'],
    'checkout.backToSite': ['Back to the site', 'Вернуться на сайт', 'Saytga qaytish'],

    /* -------------------------------------------------------- analytics */
    'analytics.pageview': ['pageview', 'просмотр', 'ko‘rish']
  };

  var INDEX = { en: 0, ru: 1, uz: 2 };

  function normalize(lang) {
    lang = String(lang || '').toLowerCase();
    if (INDEX[lang] !== undefined) return lang;
    if (lang.indexOf('ru') === 0) return 'ru';
    if (lang.indexOf('uz') === 0) return 'uz';
    return 'en';
  }

  function stored() {
    try { return normalize(window.localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return 'en'; }
  }

  var current = stored();

  function t(key, vars, lang) {
    var idx = INDEX[normalize(lang || current)] || 0;
    var entry = DICT[key];
    var out;
    if (!entry) return key;
    out = entry[idx] || entry[0];
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        out = out.split('{' + name + '}').join(String(vars[name]));
      });
    }
    return out;
  }

  /* item.i18n.<lang>.<name> with fallback to the base field */
  function field(item, name, lang) {
    if (!item) return '';
    var code = normalize(lang || current);
    if (code !== 'en' && item.i18n && item.i18n[code] && item.i18n[code][name] !== undefined &&
        item.i18n[code][name] !== null && item.i18n[code][name] !== '') {
      return item.i18n[code][name];
    }
    return item[name];
  }

  function month(i, lang) {
    var n = parseInt(i, 10);
    if (isNaN(n) || n < 0 || n > 12) n = 0;
    return t('month.' + n, null, lang);
  }

  function apply(scope) {
    scope = scope || document;
    var root = scope.querySelectorAll ? scope : document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (el) {
      var key = el.getAttribute('data-i18n');
      if (DICT[key]) el.textContent = t(key);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-placeholder]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-aria]'), function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-title]'), function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    // Month <select> elements get their <option> labels translated.
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-months]'), function (select) {
      Array.prototype.forEach.call(select.options, function (option, i) {
        option.textContent = month(i);
      });
    });
    // Footer year line keeps its structure: translate only if it has the key.
    document.documentElement.setAttribute('lang', current);
  }

  function set(lang) {
    var next = normalize(lang);
    var changed = next !== current;
    current = next;
    try { window.localStorage.setItem(STORAGE_KEY, current); } catch (e) { /* private mode */ }
    apply();
    syncSwitches();
    if (changed && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent('travosca:langchange', {
        bubbles: true,
        detail: { lang: current }
      }));
    }
    return current;
  }

  function syncSwitches() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-switch]'), function (btn) {
      var on = btn.getAttribute('data-lang') === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function initSwitches() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-switch]'), function (btn) {
      btn.addEventListener('click', function () {
        set(btn.getAttribute('data-lang') || 'en');
      });
    });
    syncSwitches();
  }

  function boot() {
    document.documentElement.setAttribute('lang', current);
    apply();
    initSwitches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }

  window.TravoscaI18n = {
    langs: LANGS,
    dict: DICT,
    t: t,
    field: field,
    month: month,
    lang: function () { return current; },
    set: set,
    apply: apply,
    syncSwitches: syncSwitches
  };
})();
