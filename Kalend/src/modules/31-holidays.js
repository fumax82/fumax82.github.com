/* ══════════════════════════════════════════════════════════════════
   MODULO v55 — "Festività" · tutte nel telefono, modificabili
   ------------------------------------------------------------------
   PERCHÉ
   Fino alla v54 le festività arrivavano da Nager.Date (termini d'uso
   commerciale non chiari) con regole offline solo per alcuni paesi.
   Ora NESSUNA chiamata di rete: le regole stanno nell'app per tutti i
   paesi dei 20 mercati, sono "indicative" (lo dice la scheda) e
   l'utente può nascondere una festa o aggiungerne una propria.

   COSA AGGIUNGE
   1. RULES: regole per i paesi che mancavano (America Latina, Africa
      francofona e lusofona, mondo arabo, Asia centrale, Macao…) e
      versioni migliorate per USA, Regno Unito, Giappone, Australia,
      Nuova Zelanda, Canada, Sudafrica, Hong Kong, India.
   2. Sintassi in più rispetto a ruleDate() del sorgente storico:
        regola>    se cade di sabato o domenica → primo giorno feriale
                   libero seguente (Regno Unito, Australia, Canada…)
        regola>s   solo se cade di domenica → lunedì (Giappone 振替休日,
                   Sudafrica, Hong Kong…)
        regola~    sabato → venerdì, domenica → lunedì (USA "observed")
        X:nome     feste da tabella, non calcolabili (Diwali, Holi,
                   Dussehra, Matariki) per gli anni 2025–2032
      Il resto (MM-DD, E±n Pasqua, O±n Pasqua ortodossa, N mese-ennesimo-
      giorno, A/B, EQ3/EQ9, SL°, C/I/H lunare-islamico-ebraico) è quello
      del sorgente storico e resta identico.
   3. Personalizzazioni (localStorage 'kx_hol_user_v1'):
        {"IT":{"hide":["Nome festa"],"add":[{"n":"Nome","r":"MM-DD"}]}}
      La scheda in Impostazioni → Lingua e paese le gestisce.
   4. Nessuna rete: il caricatore del sorgente storico usa solo rulesFor().

   Le date delle festività sono fatti: dove si è attinto al progetto
   Nager.Date (licenza MIT) la nota di licenza resta nei crediti.
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KX=window.KX=window.KX||{};
const tr=(s,p)=>{try{return typeof T==='function'?T(s,p):s;}catch(e){return s;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2=n=>String(n).padStart(2,'0');

/* ──────────────────────────────────────────────────────────────────
   1. FESTE DA TABELLA (lunisolari indù e Matariki): non si calcolano
   con i calendari disponibili; date ufficiali per il 2025–2032.
   Oltre il 2032 la festa non compare (meglio niente che sbagliata).
────────────────────────────────────────────────────────────────── */
const TABLE={
  diwali:  {2025:'10-20',2026:'11-08',2027:'10-29',2028:'10-17',2029:'11-05',2030:'10-26',2031:'11-14',2032:'11-02'},
  holi:    {2025:'03-14',2026:'03-03',2027:'03-22',2028:'03-11',2029:'03-01',2030:'03-20',2031:'03-09',2032:'03-27'},
  dussehra:{2025:'10-02',2026:'10-20',2027:'10-09',2028:'09-27',2029:'10-16',2030:'10-06',2031:'10-25',2032:'10-14'},
  matariki:{2025:'06-20',2026:'07-10',2027:'06-25',2028:'07-14',2029:'07-06',2030:'06-21',2031:'07-11',2032:'07-02'},
};

/* ──────────────────────────────────────────────────────────────────
   2. REGOLE — nome locale (e inglese dopo " / " dove utile)
────────────────────────────────────────────────────────────────── */
const RULES={
/* ── versioni migliorate (giorni sostitutivi) ── */
US:"01-01~ New Year's Day|N1-3-1 Martin Luther King Jr. Day|N2-3-1 Presidents' Day|N5-L-1 Memorial Day|06-19~ Juneteenth|07-04~ Independence Day|N9-1-1 Labor Day|N10-2-1 Columbus Day|11-11~ Veterans Day|N11-4-4 Thanksgiving Day|12-25~ Christmas Day",
GB:"01-01> New Year's Day|E-2 Good Friday|E1 Easter Monday|N5-1-1 Early May Bank Holiday|N5-L-1 Spring Bank Holiday|N8-L-1 Summer Bank Holiday|12-25> Christmas Day|12-26> Boxing Day",
IE:"01-01 New Year's Day|A02-01-1 St Brigid's Day|03-17> St Patrick's Day|E1 Easter Monday|N5-1-1 May Bank Holiday|N6-1-1 June Bank Holiday|N8-1-1 August Bank Holiday|N10-L-1 October Bank Holiday|12-25 Christmas Day|12-26 St Stephen's Day",
JP:"01-01>s 元日|N1-2-1 成人の日|02-11>s 建国記念の日|02-23>s 天皇誕生日|EQ3>s 春分の日|04-29>s 昭和の日|05-03>s 憲法記念日|05-04>s みどりの日|05-05>s こどもの日|N7-3-1 海の日|08-11>s 山の日|N9-3-1 敬老の日|EQ9>s 秋分の日|N10-2-1 スポーツの日|11-03>s 文化の日|11-23>s 勤労感謝の日",
AU:"01-01> New Year's Day|01-26> Australia Day|E-2 Good Friday|E-1 Easter Saturday|E1 Easter Monday|04-25 Anzac Day|N6-2-1 King's Birthday|12-25> Christmas Day|12-26> Boxing Day",
NZ:"01-01> New Year's Day|01-02> Day after New Year's Day|02-06> Waitangi Day|E-2 Good Friday|E1 Easter Monday|04-25> Anzac Day|N6-1-1 King's Birthday|X:matariki Matariki|N10-4-1 Labour Day|12-25> Christmas Day|12-26> Boxing Day",
CA:"01-01> New Year's Day|E-2 Good Friday|B05-24-1 Victoria Day|07-01> Canada Day|N8-1-1 Civic Holiday|N9-1-1 Labour Day|09-30 National Day for Truth and Reconciliation|N10-2-1 Thanksgiving|11-11 Remembrance Day|12-25> Christmas Day|12-26> Boxing Day",
ZA:"01-01>s New Year's Day|03-21>s Human Rights Day|E-2 Good Friday|E1 Family Day|04-27>s Freedom Day|05-01>s Workers' Day|06-16>s Youth Day|08-09>s National Women's Day|09-24>s Heritage Day|12-16>s Day of Reconciliation|12-25>s Christmas Day|12-26>s Day of Goodwill",
HK:"01-01>s 元旦 / New Year's Day|C1-1>s 農曆年初一 / Lunar New Year|C1-2>s 農曆年初二|C1-3>s 農曆年初三|SL15>s 清明節 / Ching Ming|E-2 耶穌受難節 / Good Friday|E-1 耶穌受難節翌日|E1 復活節星期一 / Easter Monday|05-01>s 勞動節 / Labour Day|C4-8>s 佛誕 / Buddha's Birthday|C5-5>s 端午節 / Tuen Ng|07-01>s 香港特別行政區成立紀念日 / HKSAR Establishment Day|C8-16>s 中秋節翌日 / Day after Mid-Autumn|10-01>s 國慶日 / National Day|C9-9>s 重陽節 / Chung Yeung|12-25 聖誕節 / Christmas Day|12-26> 聖誕節後第一個周日 / Boxing Day",
IN:"01-26 गणतंत्र दिवस / Republic Day|X:holi होली / Holi|08-15 स्वतंत्रता दिवस / Independence Day|10-02 गांधी जयंती / Gandhi Jayanti|X:dussehra दशहरा / Dussehra|X:diwali दीपावली / Diwali|12-25 क्रिसमस / Christmas",
/* ── inglese ── */
PH:"01-01 Araw ng Bagong Taon|E-3 Huwebes Santo|E-2 Biyernes Santo|E-1 Sabado de Gloria|04-09 Araw ng Kagitingan|05-01 Araw ng Paggawa|06-12 Araw ng Kalayaan|08-21 Araw ni Ninoy Aquino|N8-L-1 National Heroes Day|11-01 Undas|11-02 Araw ng mga Kaluluwa|11-30 Araw ni Bonifacio|12-08 Immaculate Conception|12-25 Pasko|12-30 Araw ni Rizal|12-31 Bisperas ng Bagong Taon|I10-1 Eid'l Fitr|I12-10 Eid'l Adha",
NG:"01-01 New Year's Day|E-2 Good Friday|E1 Easter Monday|05-01 Workers' Day|06-12 Democracy Day|10-01 Independence Day|12-25 Christmas Day|12-26 Boxing Day|I10-1 Eid al-Fitr|I10-2 Eid al-Fitr|I12-10 Eid al-Adha|I12-11 Eid al-Adha|I3-12 Eid al-Maulud",
KE:"01-01 New Year's Day|E-2 Good Friday|E1 Easter Monday|05-01 Labour Day|06-01 Madaraka Day|10-10 Utamaduni Day|10-20 Mashujaa Day|12-12 Jamhuri Day|12-25 Christmas Day|12-26 Boxing Day|I10-1 Idd-ul-Fitr|I12-10 Idd-ul-Adha",
GH:"01-01 New Year's Day|01-07 Constitution Day|03-06 Independence Day|E-2 Good Friday|E1 Easter Monday|05-01 May Day|08-04 Founders' Day|09-21 Kwame Nkrumah Memorial Day|N12-1-5 Farmers' Day|12-25 Christmas Day|12-26 Boxing Day|I10-1 Eid al-Fitr|I12-10 Eid al-Adha",
/* ── spagnolo ── */
VE:"01-01 Año Nuevo|E-48 Lunes de Carnaval|E-47 Martes de Carnaval|E-3 Jueves Santo|E-2 Viernes Santo|04-19 Declaración de la Independencia|05-01 Día del Trabajador|06-24 Batalla de Carabobo|07-05 Día de la Independencia|07-24 Natalicio de Simón Bolívar|10-12 Día de la Resistencia Indígena|12-24 Nochebuena|12-25 Navidad|12-31 Fin de Año",
EC:"01-01 Año Nuevo|E-48 Carnaval|E-47 Carnaval|E-2 Viernes Santo|05-01 Día del Trabajo|05-24 Batalla de Pichincha|08-10 Primer Grito de Independencia|10-09 Independencia de Guayaquil|11-02 Día de los Difuntos|11-03 Independencia de Cuenca|12-25 Navidad",
GT:"01-01 Año Nuevo|E-3 Jueves Santo|E-2 Viernes Santo|E-1 Sábado Santo|05-01 Día del Trabajo|06-30 Día del Ejército|09-15 Día de la Independencia|10-20 Día de la Revolución|11-01 Día de Todos los Santos|12-24 Nochebuena|12-25 Navidad|12-31 Fin de Año",
CU:"01-01 Triunfo de la Revolución|01-02 Día de la Victoria|E-2 Viernes Santo|05-01 Día de los Trabajadores|07-25 Conmemoración del Asalto al Moncada|07-26 Día de la Rebeldía Nacional|07-27 Conmemoración del Asalto al Moncada|10-10 Inicio de las Guerras de Independencia|12-25 Navidad|12-31 Fin de Año",
BO:"01-01 Año Nuevo|01-22 Día del Estado Plurinacional|E-48 Lunes de Carnaval|E-47 Martes de Carnaval|E-2 Viernes Santo|05-01 Día del Trabajo|E60 Corpus Christi|06-21 Año Nuevo Aymara|08-06 Día de la Independencia|11-02 Día de Todos los Difuntos|12-25 Navidad",
DO:"01-01 Año Nuevo|01-06 Día de los Santos Reyes|01-21 Nuestra Señora de la Altagracia|01-26 Natalicio de Juan Pablo Duarte|02-27 Día de la Independencia|E-2 Viernes Santo|05-01 Día del Trabajo|E60 Corpus Christi|08-16 Día de la Restauración|09-24 Nuestra Señora de las Mercedes|11-06 Día de la Constitución|12-25 Navidad",
HN:"01-01 Año Nuevo|E-3 Jueves Santo|E-2 Viernes Santo|E-1 Sábado de Gloria|04-14 Día de las Américas|05-01 Día del Trabajo|09-15 Día de la Independencia|10-03 Día de Francisco Morazán|10-12 Día de la Raza|10-21 Día de las Fuerzas Armadas|12-25 Navidad",
PY:"01-01 Año Nuevo|03-01 Día de los Héroes|E-3 Jueves Santo|E-2 Viernes Santo|05-01 Día del Trabajador|05-14 Día de la Independencia|05-15 Día de la Independencia|06-12 Paz del Chaco|08-15 Fundación de Asunción|09-29 Victoria de Boquerón|12-08 Virgen de Caacupé|12-25 Navidad",
SV:"01-01 Año Nuevo|E-3 Jueves Santo|E-2 Viernes Santo|E-1 Sábado Santo|05-01 Día del Trabajo|05-10 Día de la Madre|06-17 Día del Padre|08-06 Divino Salvador del Mundo|09-15 Día de la Independencia|11-02 Día de los Difuntos|12-25 Navidad",
NI:"01-01 Año Nuevo|E-3 Jueves Santo|E-2 Viernes Santo|05-01 Día del Trabajo|07-19 Aniversario de la Revolución|09-14 Batalla de San Jacinto|09-15 Día de la Independencia|12-08 Inmaculada Concepción|12-25 Navidad",
CR:"01-01 Año Nuevo|04-11 Día de Juan Santamaría|E-3 Jueves Santo|E-2 Viernes Santo|05-01 Día del Trabajo|07-25 Anexión del Partido de Nicoya|08-02 Virgen de los Ángeles|08-15 Día de la Madre|09-15 Día de la Independencia|12-01 Abolición del Ejército|12-25 Navidad",
PA:"01-01 Año Nuevo|01-09 Día de los Mártires|E-47 Martes de Carnaval|E-2 Viernes Santo|05-01 Día del Trabajo|11-03 Separación de Panamá de Colombia|11-04 Día de los Símbolos Patrios|11-05 Día de Colón|11-10 Primer Grito de Independencia|11-28 Independencia de Panamá de España|12-08 Día de las Madres|12-20 Día de Duelo Nacional|12-25 Navidad",
UY:"01-01 Año Nuevo|01-06 Día de los Niños|E-48 Carnaval|E-47 Carnaval|04-19 Desembarco de los 33 Orientales|05-01 Día de los Trabajadores|05-18 Batalla de Las Piedras|06-19 Natalicio de Artigas|07-18 Jura de la Constitución|08-25 Declaratoria de la Independencia|10-12 Día de la Diversidad Cultural|11-02 Día de los Difuntos|12-25 Día de la Familia",
PR:"01-01~ Año Nuevo|01-06 Día de Reyes|N1-3-1 Natalicio de Martin Luther King|N2-3-1 Día de los Presidentes|03-22 Abolición de la Esclavitud|E-2 Viernes Santo|N5-L-1 Día de la Recordación|07-04~ Independencia de los Estados Unidos|N7-3-1 Natalicio de Luis Muñoz Rivera|07-25~ Constitución de Puerto Rico|N9-1-1 Día del Trabajo|N10-2-1 Día de la Raza|11-11~ Día del Veterano|11-19~ Descubrimiento de Puerto Rico|N11-4-4 Acción de Gracias|12-25~ Navidad",
/* ── francese ── */
MC:"01-01 Jour de l'An|01-27 Sainte-Dévote|E1 Lundi de Pâques|05-01 Fête du Travail|E39 Ascension|E50 Lundi de Pentecôte|E60 Fête-Dieu|08-15 Assomption|11-01 Toussaint|11-19 Fête du Prince|12-08 Immaculée Conception|12-25 Noël",
SN:"01-01 Jour de l'An|04-04 Fête de l'Indépendance|E1 Lundi de Pâques|05-01 Fête du Travail|E39 Ascension|E50 Lundi de Pentecôte|08-15 Assomption|11-01 Toussaint|12-25 Noël|I10-1 Korité|I12-10 Tabaski|I1-10 Tamkharit|I3-12 Maouloud",
CI:"01-01 Jour de l'An|E1 Lundi de Pâques|05-01 Fête du Travail|E39 Ascension|E50 Lundi de Pentecôte|08-07 Fête de l'Indépendance|08-15 Assomption|11-01 Toussaint|11-15 Journée Nationale de la Paix|12-25 Noël|I10-1 Aïd el-Fitr|I12-10 Tabaski|I3-12 Maouloud|I9-27 Nuit du Destin",
TN:"01-01 رأس السنة / Jour de l'An|01-14 عيد الثورة / Fête de la Révolution|03-20 عيد الاستقلال / Fête de l'Indépendance|04-09 عيد الشهداء / Journée des Martyrs|05-01 عيد الشغل / Fête du Travail|07-25 عيد الجمهورية / Fête de la République|08-13 عيد المرأة / Fête de la Femme|10-15 عيد الجلاء / Fête de l'Évacuation|12-17 عيد الثورة / Fête de la Révolution|I10-1 عيد الفطر|I10-2 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي",
DZ:"01-01 رأس السنة|01-12 يناير / Yennayer|05-01 عيد العمال|07-05 عيد الاستقلال|11-01 عيد الثورة|I10-1 عيد الفطر|I10-2 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I1-1 رأس السنة الهجرية|I1-10 عاشوراء|I3-12 المولد النبوي",
/* ── tedesco ── */
LI:"01-01 Neujahr|01-06 Heilige Drei Könige|02-02 Mariä Lichtmess|03-19 Josefstag|E1 Ostermontag|05-01 Tag der Arbeit|E39 Auffahrt|E50 Pfingstmontag|E60 Fronleichnam|08-15 Staatsfeiertag|09-08 Mariä Geburt|11-01 Allerheiligen|12-08 Mariä Empfängnis|12-25 Weihnachten|12-26 Stephanstag",
/* ── portoghese ── */
AO:"01-01 Ano Novo|02-04 Dia do Início da Luta Armada|E-47 Carnaval|03-08 Dia da Mulher|03-23 Dia da Libertação da África Austral|04-04 Dia da Paz|E-2 Sexta-feira Santa|05-01 Dia do Trabalhador|09-17 Dia do Fundador da Nação e do Herói Nacional|11-02 Dia dos Finados|11-11 Dia da Independência|12-25 Natal",
MZ:"01-01 Ano Novo|02-03 Dia dos Heróis Moçambicanos|04-07 Dia da Mulher Moçambicana|05-01 Dia do Trabalhador|06-25 Dia da Independência|09-07 Dia da Vitória|09-25 Dia das Forças Armadas|10-04 Dia da Paz e Reconciliação|12-25 Dia da Família",
/* ── olandese ── */
SR:"01-01 Nieuwjaar|C1-1 Chinees Nieuwjaar|X:holi Holi Phagwa|E-2 Goede Vrijdag|E1 Paasmaandag|05-01 Dag van de Arbeid|07-01 Keti Koti|08-09 Dag der Inheemsen|10-10 Dag van de Marrons|X:diwali Divali|11-25 Onafhankelijkheidsdag|12-25 Kerstmis|12-26 Tweede kerstdag|I10-1 Ied-ul-Fitr",
/* ── russo ── */
BY:"01-01 Новы год|01-02 Новы год|01-07 Раство Хрыстова (праваслаўнае)|03-08 Дзень жанчын|O9 Радаўніца|05-01 Свята працы|05-09 Дзень Перамогі|07-03 Дзень Незалежнасці|11-07 Дзень Кастрычніцкай рэвалюцыі|12-25 Раство Хрыстова (каталіцкае)",
KZ:"01-01 Жаңа жыл|01-02 Жаңа жыл|01-07 Православиелік Рождество|03-08 Халықаралық әйелдер күні|03-21 Наурыз мейрамы|03-22 Наурыз мейрамы|03-23 Наурыз мейрамы|05-01 Қазақстан халқының бірлігі күні|05-07 Отан қорғаушы күні|05-09 Жеңіс күні|07-06 Астана күні|08-30 Конституция күні|10-25 Республика күні|12-16 Тәуелсіздік күні|I12-10 Құрбан айт",
/* ── arabo ── */
IQ:"01-01 رأس السنة الميلادية|01-06 عيد الجيش|03-21 نوروز|05-01 عيد العمال|07-14 عيد الجمهورية|10-03 العيد الوطني|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I1-10 عاشوراء|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى|I12-13 عيد الأضحى",
JO:"01-01 رأس السنة الميلادية|05-01 عيد العمال|05-25 عيد الاستقلال|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I7-27 الإسراء والمعراج|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى|I12-13 عيد الأضحى",
LB:"01-01 رأس السنة|01-06 عيد الغطاس|02-09 عيد مار مارون|02-14 ذكرى اغتيال رفيق الحريري|E-2 الجمعة العظيمة|E1 اثنين الفصح|O-2 الجمعة العظيمة (الشرقية)|O1 اثنين الفصح (الشرقي)|05-01 عيد العمال|08-15 عيد انتقال السيدة العذراء|11-22 عيد الاستقلال|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I1-10 عاشوراء|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى",
KW:"01-01 رأس السنة الميلادية|02-25 العيد الوطني|02-26 يوم التحرير|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I7-27 الإسراء والمعراج|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
QA:"N2-2-2 اليوم الرياضي|12-18 اليوم الوطني|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
BH:"01-01 رأس السنة الميلادية|05-01 عيد العمال|12-16 اليوم الوطني|12-17 اليوم الوطني|I1-1 رأس السنة الهجرية|I1-9 عاشوراء|I1-10 عاشوراء|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
OM:"11-18 العيد الوطني|11-19 العيد الوطني|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I7-27 الإسراء والمعراج|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
SY:"01-01 رأس السنة الميلادية|03-21 عيد الأم|04-17 عيد الجلاء|E-2 الجمعة العظيمة|O-2 الجمعة العظيمة (الشرقية)|05-01 عيد العمال|05-06 عيد الشهداء|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى|I12-13 عيد الأضحى",
LY:"02-17 ثورة 17 فبراير|05-01 عيد العمال|09-16 يوم الشهيد|10-23 يوم التحرير|12-24 عيد الاستقلال|I1-1 رأس السنة الهجرية|I1-10 عاشوراء|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
SD:"01-01 عيد الاستقلال|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى|I12-13 عيد الأضحى",
YE:"05-01 عيد العمال|05-22 العيد الوطني|09-26 ثورة 26 سبتمبر|10-14 ثورة 14 أكتوبر|11-30 عيد الاستقلال|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى",
PS:"01-01 رأس السنة الميلادية|05-01 عيد العمال|11-15 يوم الاستقلال|12-25 عيد الميلاد|I1-1 رأس السنة الهجرية|I3-12 المولد النبوي|I7-27 الإسراء والمعراج|I10-1 عيد الفطر|I10-2 عيد الفطر|I10-3 عيد الفطر|I12-9 يوم عرفة|I12-10 عيد الأضحى|I12-11 عيد الأضحى|I12-12 عيد الأضحى|I12-13 عيد الأضحى",
/* ── cinese ── */
MO:"01-01 元旦|C1-1 農曆新年|C1-2 農曆新年|C1-3 農曆新年|SL15 清明節|E-2 耶穌受難日|E-1 復活節前日|05-01 勞動節|C4-8 佛誕節|C5-5 端午節|C8-16 中秋節翌日|10-01 國慶日|10-02 國慶日翌日|C9-9 重陽節|11-02 追思節|12-08 聖母無原罪瞻禮日|12-20 澳門特別行政區成立紀念日|SL270 冬至|12-24 聖誕節前日|12-25 聖誕節",
};
/* calendari islamico/cinese anche per paesi che nel sorgente storico ne erano privi */
const CALC={
  IN:[['I',10,1,'ईद उल-फ़ित्र / Eid al-Fitr'],['I',12,10,'बकरीद / Eid al-Adha'],['C',4,15,'बुद्ध पूर्णिमा / Buddha Purnima']],
};

/* ──────────────────────────────────────────────────────────────────
   3. PARSER: regole con suffissi (>, >s, ~) e feste da tabella (X:)
────────────────────────────────────────────────────────────────── */
const dow=k=>new Date(k+'T12:00:00').getDay();
const shiftKey=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());};
function baseDate(code,y){
  let m;
  if((m=code.match(/^X:([a-z]+)$/)))return TABLE[m[1]]&&TABLE[m[1]][y]?y+'-'+TABLE[m[1]][y]:null;
  try{if(window.KX&&KX.HolRules&&KX.HolRules.ruleDate)return KX.HolRules.ruleDate(code,y);}catch(e){}
  return null;
}
/* "01-01>s Nome" → {code:'01-01',mode:'sun',name:'Nome'} */
function parseRule(x){
  const sp=x.indexOf(' ');if(sp<0)return null;
  let code=x.slice(0,sp),name=x.slice(sp+1),mode='';
  if(code.endsWith('>s')){mode='sun';code=code.slice(0,-2);}
  else if(code.endsWith('>')){mode='next';code=code.slice(0,-1);}
  else if(code.endsWith('~')){mode='obs';code=code.slice(0,-1);}
  return {code,mode,name};
}
function expand(str,y,cc){
  const out=[];const taken=new Set();
  const items=str.split('|').map(parseRule).filter(Boolean);
  items.forEach(it=>{const k=baseDate(it.code,y);if(k){out.push({date:k,name:it.name,mode:it.mode,orig:k});taken.add(k);}});
  /* giorni sostitutivi: calcolati DOPO, così si evitano le collisioni.
     La festa resta nel suo giorno; si AGGIUNGE il giorno sostitutivo
     (in Giappone si chiama 振替休日, altrove «(sostitutivo)»). */
  const subs=[];
  out.forEach(h=>{
    if(!h.mode)return;
    const d=dow(h.orig);let k=null;
    if(h.mode==='obs'){if(d===6)k=shiftKey(h.orig,-1);else if(d===0)k=shiftKey(h.orig,1);}
    else if((h.mode==='next'&&(d===0||d===6))||(h.mode==='sun'&&d===0)){
      k=shiftKey(h.orig,d===6?2:1);
      while(taken.has(k)||dow(k)===0||dow(k)===6)k=shiftKey(k,1);
    }
    if(k){taken.add(k);subs.push({date:k,name:cc==='JP'?'振替休日':h.name+' '+tr('(sostitutivo)')});}
  });
  return out.map(h=>({date:h.date,name:h.name})).concat(subs);
}
function calc(cc,y){
  const list=CALC[cc];const AltCal=(window.KX&&KX.HolRules&&KX.HolRules.altCal)?KX.HolRules.altCal():null;if(!list||!AltCal)return [];
  const out=[];list.forEach(([kind,mo,da,name])=>{let k=null;try{k=AltCal.find(kind==='I'?'islamic-umalqura':kind==='C'?'chinese':'hebrew',y,String(mo),da);}catch(e){}if(k)out.push({date:k,name});});
  return out;
}

/* ──────────────────────────────────────────────────────────────────
   4. PERSONALIZZAZIONI DELL'UTENTE
────────────────────────────────────────────────────────────────── */
const User={
  KEY:'kx_hol_user_v1',data:null,
  load(){if(this.data)return this.data;try{this.data=JSON.parse(localStorage.getItem(this.KEY)||'{}')||{};}catch(e){this.data={};}return this.data;},
  save(){try{localStorage.setItem(this.KEY,JSON.stringify(this.load()));}catch(e){}},
  of(cc){const d=this.load();return d[cc]||(d[cc]={hide:[],add:[]});},
  hide(cc,name,on){const u=this.of(cc);u.hide=u.hide.filter(n=>n!==name);if(on)u.hide.push(name);this.save();},
  add(cc,name,rule){const u=this.of(cc);u.add.push({n:String(name).slice(0,60),r:rule});this.save();},
  remove(cc,i){const u=this.of(cc);u.add.splice(i,1);this.save();},
  reset(cc){const d=this.load();delete d[cc];this.save();},
};

/* ──────────────────────────────────────────────────────────────────
   5. AGGANCIO: rulesFor(cc,y) del sorgente storico
────────────────────────────────────────────────────────────────── */
/* elenco completo di un paese per un anno: regole di questo modulo
   (o quelle del sorgente storico), più le feste calcolate del modulo
   calendari (islamiche, lunari, ebraiche), meno quelle nascoste, più
   quelle aggiunte dall'utente */
function list(cc,y){
  const H=window.KX&&KX.HolRules;
  let out;
  if(RULES[cc])out=expand(RULES[cc],y,cc).concat(calc(cc,y));
  else out=(H&&H.rulesFor)?(H.rulesFor(cc,y)||[]):[];
  try{if(KX.AltDate&&KX.AltDate.calcHolidays){const have=new Set(out.map(h=>h.date+'|'+h.name));KX.AltDate.calcHolidays(cc,y).forEach(h=>{if(!have.has(h.date+'|'+h.name))out.push(h);});}}catch(e){}
  const u=User.of(cc);const hide=new Set(u.hide||[]);
  out=out.filter(h=>!hide.has(h.name));
  (u.add||[]).forEach(a=>{const k=baseDate(a.r,y);if(k)out.push({date:k,name:a.n,user:1});});
  return out.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
}
function install(){
  /* il selettore dei paesi vede anche quelli aggiunti qui */
  try{const H=window.KX&&KX.HolRules;if(H&&H.rules)Object.keys(RULES).forEach(cc=>{if(!H.rules[cc])H.rules[cc]=RULES[cc];});}catch(e){}
  try{if(typeof buildCountryOptions==='function')buildCountryOptions();}catch(e){}
}
function refresh(){
  try{if(typeof AppSettings==='object'){Object.keys(AppSettings.holidays||{}).forEach(k=>delete AppSettings.holidays[k]);}}catch(e){}
  try{if(typeof fetchHolidays==='function')fetchHolidays(AppSettings.country);}catch(e){}
}

/* ──────────────────────────────────────────────────────────────────
   6. SCHEDA: Impostazioni → Lingua e paese → Festività del paese
────────────────────────────────────────────────────────────────── */
function card(){
  const ref=document.getElementById('set-country');if(!ref||document.getElementById('kx-hol-card'))return;
  const host=ref.closest('.form-group');if(!host)return;
  const c=document.createElement('div');c.id='kx-hol-card';c.className='form-group';
  host.insertAdjacentElement('afterend',c);
  render(c);
  ref.addEventListener('change',()=>setTimeout(()=>render(c),400));
}
function render(c){
  const cc=AppSettings.country;const y=new Date().getFullYear();
  let cur=[];try{cur=list(cc,y);}catch(e){}
  const u=User.of(cc);const hide=new Set(u.hide||[]);
  let base=[];try{base=(RULES[cc]?expand(RULES[cc],y,cc).concat(calc(cc,y)):[]);}catch(e){}
  const all=cur.concat(base.filter(h=>hide.has(h.name)).map(h=>Object.assign({hidden:1},h))).sort((a,b)=>a.date<b.date?-1:1);
  const fmt=k=>{try{return new Date(k+'T12:00:00').toLocaleDateString(L10N.locale,{day:'numeric',month:'short'});}catch(e){return k.slice(5);}};
  c.innerHTML=`<div class="form-label">🎌 ${esc(tr('Festività del paese'))} · ${y}</div>
    <div class="set-caption">${esc(tr('Indicative: controlla le fonti ufficiali. Tocca una festa per nasconderla o mostrarla.'))}</div>
    <div class="kx-hol-list">${all.length?all.map(h=>`<button type="button" class="kx-hol-it${h.hidden?' off':''}${h.user?' user':''}" data-name="${esc(h.name)}" data-user="${h.user?'1':''}"><span class="kx-hol-d">${esc(fmt(h.date))}</span><span class="kx-hol-n">${esc(h.name)}</span><span class="kx-hol-x">${h.user?'🗑':(h.hidden?'○':'●')}</span></button>`).join(''):`<div class="set-caption">${esc(tr('Nessuna festività in archivio per questo paese: aggiungi le tue.'))}</div>`}</div>
    <div class="kx-hol-add"><input type="text" class="form-input" id="kx-hol-name" placeholder="${esc(tr('Nome'))}" maxlength="60"><input type="text" class="form-input" id="kx-hol-date" placeholder="${esc(tr('Giorno e mese (GG/MM)'))}" inputmode="numeric" maxlength="5"><button type="button" class="kx-btn" id="kx-hol-plus">＋ ${esc(tr('Aggiungi'))}</button></div>
    ${(u.hide&&u.hide.length)||(u.add&&u.add.length)?`<button type="button" class="kx-hol-reset" id="kx-hol-reset">↺ ${esc(tr('Ripristina le festività predefinite'))}</button>`:''}`;
  c.querySelectorAll('.kx-hol-it').forEach(b=>b.addEventListener('click',()=>{
    const name=b.dataset.name;
    if(b.dataset.user){const i=(u.add||[]).findIndex(a=>a.n===name);if(i>=0)User.remove(cc,i);}
    else User.hide(cc,name,!hide.has(name));
    refresh();render(c);
  }));
  c.querySelector('#kx-hol-plus').addEventListener('click',()=>{
    const name=(c.querySelector('#kx-hol-name').value||'').trim();const dt=(c.querySelector('#kx-hol-date').value||'').trim();
    const m=dt.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
    if(!name||!m){try{toast('⚠️ '+tr('Serve un nome e una data come 25/04'));}catch(e){}return;}
    const dd=+m[1],mm=+m[2];if(mm<1||mm>12||dd<1||dd>31){try{toast('⚠️ '+tr('Serve un nome e una data come 25/04'));}catch(e){}return;}
    User.add(cc,name,pad2(mm)+'-'+pad2(dd));refresh();render(c);
  });
  const r=c.querySelector('#kx-hol-reset');if(r)r.addEventListener('click',()=>{User.reset(cc);refresh();render(c);});
}

KX.Holidays={RULES,TABLE,expand,list,user:User,refresh,_parse:parseRule};
function boot(){install();try{card();}catch(e){console.warn('[feste] scheda',e);}
  /* le feste in archivio vengono rigenerate dalle regole (niente più rete) */
  try{const cur=AppSettings.holidays||{};const stale=Object.values(cur).some(a=>Array.isArray(a)&&a.length&&!a[0].fb&&a[0].v===2);if(stale)refresh();}catch(e){}
}
if(document.readyState==='complete')setTimeout(boot,350);else addEventListener('load',()=>setTimeout(boot,350));
})();
