/*
 * products.js - RICONOSCIMENTO DEL REPARTO di un prodotto dello scontrino
 * (frutta, alcolici, uova...), per qualsiasi supermercato.
 *
 * Sugli scontrini i nomi sono corti e abbreviati ("PROSC.CRUDO", "YOG.BIANCO",
 * "DETERS.PIATTI"), con marche ("MORETTI", "FINISH") e a volte letti con errori
 * dall'OCR ("MOZZARELIA"). Per riconoscerli:
 *
 *  1. Il nome viene diviso in parole e pulito (pesi, quantità e codici tolti).
 *  2. Ogni parola viene confrontata con un DIZIONARIO di circa 1.300 voci:
 *       - per radice      "mozzarell" riconosce MOZZARELLA, MOZZARELLE
 *       - per abbreviazione "mozz", "prosc", "yog" riconoscono le parole lunghe
 *       - con tolleranza  una lettera sbagliata nelle parole lunghe (OCR)
 *  3. Ogni voce ha un PESO:
 *       3 = TIPO di prodotto (yogurt, succo, biscotti, birra, detersivo, cane...)
 *       2 = prodotto o marca
 *       1 = ingrediente/gusto (fragola, cioccolato, limone, affettato...)
 *     In "YOGURT FRAGOLA" vince il tipo (yogurt) sul gusto (fragola);
 *     in "FRAGOLE 500G" c'è solo fragola, quindi è frutta.
 *     A parità di peso vince la parola che compare prima.
 *  4. Prima di tutto contano le TUE CORREZIONI (vedi learned):
 *       learned.products = { "nome prodotto normalizzato": "Reparto" }
 *       learned.words    = { "parola": "Reparto" }
 *
 * Per aggiungere una parola basta metterla nella lista del reparto giusto.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  // Reparti: nome, icona, e parole divise per peso
  // t = tipo di prodotto (peso 3), w = prodotti e marche (peso 2), f = gusti/ingredienti (peso 1)
  const DEPARTMENTS = [
    { name: 'Frutta', icon: '🍎',
      w: ['mela', 'mele', 'banan', 'aranc', 'pera', 'pere', 'kiwi', 'uva', 'limon', 'fragol', 'ananas', 'pesca', 'pesche', 'nettarin', 'albicocc', 'mandarin',
        'clementin', 'melone', 'meloni', 'anguria', 'cocomer', 'mirtill', 'lampon', 'ribes', 'more', 'ciliegi', 'avocado', 'mango', 'papaya', 'pompelm', 'melagran',
        'cachi', 'kaki', 'fichi', 'fico', 'prugn', 'susin', 'castagn', 'noci', 'nocciol', 'mandorl', 'pistacch', 'datter', 'uvetta', 'frutta', 'frutti di bosco',
        'golden', 'granny smith', 'pink lady', 'fuji', 'renetta', 'stark', 'abate', 'kaiser', 'williams', 'tarocco', 'moro', 'navel', 'chiquita', 'del monte', 'dole',
        'lime', 'cedro', 'cocco', 'maracuja', 'litchi', 'kumquat', 'nespol', 'mapo', 'ban'],
      f: [] },
    { name: 'Verdura', icon: '🥦',
      w: ['insalat', 'ins', 'lattug', 'iceberg', 'rucola', 'valeriana', 'songino', 'gentile', 'romana', 'radicchi', 'indivia', 'scarola', 'cicoria', 'spinac',
        'bietol', 'pomodor', 'pom', 'ciliegin', 'datterin', 'piccadilly', 'cuore di bue', 'zucchin', 'zucca', 'patat', 'carot', 'cipoll', 'scalogn', 'aglio', 'porri', 'porro',
        'finocch', 'peperon', 'melanzan', 'broccol', 'cavol', 'cavolfior', 'verza', 'cappucc', 'carciof', 'asparag', 'fagiolin', 'tegolin', 'piselli fres', 'sedano',
        'cetriol', 'funghi', 'champignon', 'porcini', 'basilico', 'prezzemol', 'rosmarino', 'salvia', 'erba cipollina', 'menta', 'rapa', 'ravanell', 'barbabietol',
        'topinambur', 'pasta gialla', 'pasta bianca', 'mais pannocch', 'verdur', 'ortaggi', 'misticanza', 'germogli', 'zenzero', 'peperoncino fresco', 'friarielli', 'cime di rapa', 'agretti', 'catalogna'],
      f: [] },
    { name: 'Carne', icon: '🥩',
      t: ['carne', 'macelleria'],
      w: ['pollo', 'polli', 'petto', 'fusi', 'fuselli di pollo', 'cosce', 'sovracosc', 'ali di pollo', 'alette', 'tacchin', 'manzo', 'bovino', 'bov', 'scottona', 'vitell', 'vitellon',
        'suino', 'maiale', 'lonza', 'braciol', 'costin', 'salsicc', 'macinat', 'macin', 'trita', 'hamburger', 'burger', 'bistecc', 'fettin', 'scaloppin', 'arrosto',
        'spezzatino', 'brasato', 'bollito', 'spiedin', 'cotolett', 'agnello', 'capretto', 'coniglio', 'anatra', 'faraona', 'cappone', 'tagliata', 'fiorentina',
        'filetto di manzo', 'entrecote', 'roast beef', 'polpett', 'involtin', 'stinco', 'ossobuco', 'girello', 'noce di vitello', 'fesa di vitello', 'cordon bleu', 'amadori', 'aia', 'fileni'],
      f: [] },
    { name: 'Pesce', icon: '🐟',
      t: ['pesce', 'pescheria'],
      w: ['salmon', 'merluzz', 'nasello', 'platessa', 'sogliola', 'orata', 'branzin', 'spigola', 'trota', 'tonno fresco', 'pesce spada', 'gamber', 'mazzancoll', 'scampi',
        'cozze', 'vongole', 'calamar', 'totani', 'seppi', 'polpo', 'moscardin', 'alici', 'acciugh', 'sardin', 'baccala', 'stoccafisso', 'surimi', 'tranci', 'filetti di',
        'frutti di mare', 'ostriche', 'capesante', 'cernia', 'rombo', 'dentice', 'sgombro fresco', 'pangasio', 'halibut', 'persico'],
      f: [] },
    { name: 'Salumi', icon: '🥓',
      t: ['salumi', 'salumeria'],
      w: ['prosciut', 'prosc', 'crudo', 'cotto', 'pr cotto', 'pr crudo', 'salame', 'salami', 'mortadell', 'mortad', 'bresaola', 'speck', 'pancett', 'coppa', 'capocollo',
        'culatello', 'fiocco', 'lardo', 'guanciale', 'nduja', 'wurstel', 'wuber', 'cotechino', 'zampone', 'porchetta', 'finocchiona', 'soppressata', 'fesa tacchino',
        'arrosto di tacchino affett', 'rovagnati', 'beretta', 'fiorucci', 'citterio', 'negroni', 'golfetta', 'parma', 'san daniele', 'praga', 'tirolese', 'kaiserfleisch'],
      f: ['affett'] },
    { name: 'Latte e formaggi', icon: '🧀',
      t: ['yogurt', 'yog', 'yogh', 'yoghurt', 'formagg', 'form', 'latte', 'latt', 'latticin', 'skyr', 'kefir'],
      w: ['mozzarell', 'mozz', 'bufala', 'fior di latte', 'burrata', 'stracciatella', 'parmigian', 'grana', 'padano', 'reggiano', 'pecorino', 'burro', 'burrin',
        'ricotta', 'panna', 'stracchino', 'crescenza', 'squacquerone', 'gorgonzola', 'mascarpone', 'emmental', 'emmenthal', 'groviera', 'gruyere', 'provola', 'provolon',
        'provo', 'scamorza', 'caciocav', 'asiago', 'montasio', 'fontina', 'taleggio', 'quartirolo', 'robiola', 'caprino', 'brie', 'camembert', 'feta', 'edamer', 'tilsiter',
        'leerdammer', 'galbanino', 'sottilette', 'philadelphia', 'spalmabile', 'formaggino', 'formaggini', 'galbani', 'parmalat', 'granarolo', 'zymil', 'mila', 'muller',
        'danone', 'activia', 'actimel', 'vipiteno', 'vipit', 'fage', 'santa lucia', 'nonno nanni', 'alta qualita', 'uht', 'parzialmente scremato', 'intero', 'ps',
        'bevanda soia', 'bevanda avena', 'bevanda riso', 'bevanda mandorla', 'alpro', 'milk', 'tomino', 'primosale', 'mozzarelline', 'bocconcini di bufala', 'jocca', 'fiocchi di latte', 'lurpak'],
      f: [] },
    { name: 'Uova', icon: '🥚',
      t: ['uova', 'uovo'],
      w: [] },
    { name: 'Pane e forno', icon: '🍞',
      t: ['pane', 'panificio', 'forno'],
      w: ['baguette', 'filone', 'ciabatt', 'rosett', 'michett', 'panin', 'panino al latte', 'focacc', 'piadin', 'grissin', 'gris', 'cracker', 'fette biscott', 'pan carre',
        'pancarre', 'pan bauletto', 'bauletto', 'pane in cassetta', 'tramezzino pane', 'taralli', 'tarall', 'friselle', 'frisell', 'schiacciat', 'crostini', 'bruschett',
        'brioche', 'cornett', 'croissant', 'pan brioche', 'gallette di riso', 'gallette di mais', 'spaccat', 'integrale', 'wasa', 'harry', 'pavesi', 'gallette', 'tigelle', 'crescentine', 'muffin inglesi', 'tortillas'],
      f: [] },
    { name: 'Pasta, riso e farine', icon: '🍝',
      t: ['pasta', 'riso', 'farina'],
      w: ['spaghett', 'spaghettoni', 'bucatini', 'linguine', 'bavette', 'penne', 'pennette', 'fusilli', 'rigatoni', 'mezze maniche', 'maniche', 'farfalle', 'tagliatell',
        'fettuccine', 'pappardelle', 'tagliolini', 'lasagne', 'cannelloni', 'tortellin', 'tortelloni', 'ravioli', 'agnolotti', 'cappelletti', 'gnocchi', 'orecchiette',
        'paccheri', 'trofie', 'casarecce', 'conchiglie', 'ditalini', 'stelline', 'tubetti', 'mafalde', 'calamarata', 'sedanini', 'gemelli', 'strozzapreti', 'pici',
        'carnaroli', 'arborio', 'basmati', 'vialone', 'parboiled', 'riso venere', 'cous cous', 'couscous', 'orzo', 'farro', 'quinoa', 'bulgur', 'semola', 'polenta',
        'manitoba', 'pangrattato', 'barilla', 'de cecco', 'divella', 'garofalo', 'rummo', 'voiello', 'la molisana', 'rana', 'scotti', 'gallo', 'buitoni', 'giovanni rana'],
      f: [] },
    { name: 'Dispensa', icon: '🥫',
      t: ['olio', 'aceto', 'caffe', 'cereali'],
      w: ['evo', 'extravergine', 'extrav', 'girasole', 'semi di', 'balsamico', 'sale', 'zucchero', 'dolcificante', 'passata', 'polpa', 'pelati', 'concentrato', 'pomodorini in',
        'ceci', 'fagioli', 'lenticch', 'piselli', 'legumi', 'mais', 'tonno', 'sgombro', 'sardine in', 'caffe', 'espresso', 'capsul', 'cialde', 'orzo solubile', 'te', 'the',
        'camomill', 'tisan', 'infuso', 'maionese', 'ketchup', 'senape', 'salsa', 'pesto', 'sugo', 'ragu', 'marmellat', 'confettur', 'miele', 'muesli', 'fiocchi',
        'corn flakes', 'porridge', 'avena', 'dado', 'brodo', 'spezie', 'pepe', 'origano', 'curry', 'paprika', 'cannella', 'noce moscata', 'olive', 'capperi', 'sottaceti',
        'sottolio', 'giardiniera', 'carciofini', 'funghi trifolati', 'lievito', 'cacao', 'amido', 'fecola', 'vanillina', 'aromi', 'crema di', 'mutti', 'cirio', 'de rica',
        'knorr', 'star', 'rio mare', 'nostromo', 'callipo', 'mareblu', 'calve', 'bertolli', 'carapelli', 'monini', 'sasso', 'lavazza', 'kimbo', 'segafredo', 'illy',
        'nescafe', 'pellini', 'borbone', 'kellogg', 'pomi', 'valfrutta legumi', 'zuppa', 'minestra', 'vellutata', 'lievito di birra', 'cacao amaro'],
      f: [] },
    { name: 'Dolci e snack', icon: '🍪',
      t: ['biscott', 'bisc', 'snack', 'merendin', 'dolci'],
      w: ['frollini', 'cioccolat', 'cioc', 'tavolett', 'cioccolatini', 'praline', 'patatin', 'chips', 'pop corn', 'popcorn', 'noccioline', 'arachidi', 'salatini',
        'caramell', 'chewing', 'gomme', 'mentine', 'wafer', 'crostatin', 'torta', 'tortina', 'plumcake', 'pandoro', 'panettone', 'colomba', 'savoiardi', 'pan di spagna',
        'crema spalmabile', 'nutella', 'barrett', 'kinder', 'ferrero', 'ferr', 'milka', 'lindt', 'novi', 'perugina', 'baci', 'pocket coffee', 'loacker', 'pan di stelle',
        'gocciole', 'oro saiwa', 'saiwa', 'crik crok', 'pringles', 'san carlo', 'amica chips', 'fonzies', 'oreo', 'togo', 'doria', 'balocco', 'mulino bianco', 'galbusera',
        'delizie', 'brioss', 'fiesta', 'tegolino', 'buondi', 'yo yo', 'flauti', 'mars', 'twix', 'snickers', 'bounty', 'haribo', 'tic tac', 'mentos', 'cantucci', 'amaretti',
        'meringhe', 'krapfen', 'muffin', 'donut', 'sfogliatin', 'tarallini dolci', 'dolcetti', 'confetti', 'torroncin', 'torrone'],
      f: [] },
    { name: 'Bevande', icon: '🥤',
      t: ['acqua', 'acq', 'succo', 'bibita', 'bevanda', 'spremuta', 'nettare'],
      w: ['the limone', 'the pesca', 'te limone', 'te pesca', 'the verde freddo', 'naturale', 'frizzante', 'effervescente', 'coca', 'pepsi', 'aranciata', 'limonata', 'cedrata', 'chinotto', 'gassosa', 'gazzosa', 'tonica', 'schweppes',
        'sprite', 'fanta', 'seven up', 'lemon soda', 'oransoda', 'the freddo', 'te freddo', 'estathe', 'estate', 'lipton', 'san benedetto', 'red bull', 'monster',
        'energetica', 'energy', 'gatorade', 'powerade', 'kombucha', 'smoothie', 'frullato', 'levissima', 'ferrarelle', 'san pellegrino', 'pellegrino', 'sant anna',
        's anna', 's angelo', 'rocchetta', 'uliveto', 'lete', 'panna', 'vera', 'boario', 'norda', 'santal', 'skipper', 'yoga', 'derby', 'ace', 'bravo', 'pago', 'zero'],
      f: [] },
    { name: 'Alcolici', icon: '🍷',
      t: ['vino', 'vini', 'birra', 'birre', 'liquore', 'grappa', 'spumante', 'prosecco'],
      w: ['amaro', 'rosso', 'bianco', 'rosato', 'docg', 'doc', 'igt', 'chianti', 'barolo', 'barbaresco', 'barbera', 'dolcetto', 'nebbiolo', 'montepulciano', 'sangiovese',
        'primitivo', 'negroamaro', 'nero d avola', 'aglianico', 'lambrusco', 'bardolino', 'valpolicella', 'amarone', 'soave', 'pinot', 'merlot', 'cabernet', 'chardonnay',
        'sauvignon', 'vermentino', 'falanghina', 'greco di tufo', 'gewurztraminer', 'muller thurgau', 'trebbiano', 'verdicchio', 'moscato', 'brachetto', 'franciacorta',
        'trentodoc', 'champagne', 'cava', 'spritz', 'aperol', 'campari', 'martini', 'vermouth', 'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'tequila', 'brandy', 'cognac',
        'limoncello', 'amaretto', 'sambuca', 'baileys', 'jager', 'jagermeister', 'montenegro', 'ramazzotti', 'averna', 'lucano', 'braulio', 'fernet', 'grap', 'moretti',
        'peroni', 'nastro azzurro', 'heineken', 'menabrea', 'ichnusa', 'tennent', 'corona', 'beck', 'ceres', 'bud', 'leffe', 'guinness', 'poretti', 'forst', 'dreher',
        'tuborg', 'carlsberg', 'paulaner', 'weiss', 'lager', 'ipa', 'sidro', 'tavernello'],
      f: [] },
    { name: 'Surgelati', icon: '🧊',
 t: ['surgel', 'surg', 'gelat', 'congelat', 'frozen', 'bastoncin'],
      w: ['findus', 'orogel', 'sofficin', '4 salti', 'quattro salti', 'algida', 'magnum', 'cornetto algida', 'cucciolone', 'ghiaccioli', 'sammontana',
        'carte d or', 'pizza buitoni', 'buitoni pizza', 'minestrone', 'patatine fritte', 'patate fritte', 'pizza surg', 'capitan findus', 'buitoni pizza', 'cuor di merluzzo', 'spinaci cubetti', 'mais surg'],
      f: [] },
    { name: 'Pronti e gastronomia', icon: '🥗',
      t: ['gastronomia', 'rosticceria'],
      w: ['pronto', 'pronta', 'pronti', 'pronte', 'pizza', 'sushi', 'hummus', 'tramezzin', 'panino farcito', 'piadina farcita', 'insalatona', 'insalata di riso', 'insalata di pollo', 'insalata russa', 'pollo arrosto',
        'pollo allo spiedo', 'arancin', 'supplì', 'suppli', 'olive ascolane', 'parmigiana', 'lasagna pronta', 'lasagne pronte', 'piatto', 'zuppa pronta', 'poke', 'wrap',
        'pizza margherita fresca', 'pizza fresca', 'pizzetta', 'torta salata', 'quiche', 'frittata', 'polpette al sugo', 'vitello tonnato', 'caprese', 'gnocco fritto',
        'crocchette di patate', 'mozzarella in carrozza', 'sformato', 'cous cous pronto'],
      f: [] },
    { name: 'Casa e pulizia', icon: '🧽',
      t: ['detersiv', 'deters', 'ammorbid', 'pulizia', 'lavastovigl', 'lavatrice', 'candeggin', 'sgrassat', 'anticalcare'],
      w: ['carta igien', 'igienica', 'scottex', 'regina', 'foxy', 'tenderly', 'carta cucina', 'asciugatutto', 'rotoloni', 'tovagliol', 'fazzolett', 'tempo', 'kleenex',
        'spugn', 'sacchett', 'sacchi', 'spazzatura', 'pellicol', 'alluminio', 'domopak', 'carta forno', 'pastiglie', 'brillantant', 'sale lavastov', 'capsule lavastov',
        'piatti carta', 'piatti plastica', 'bicchieri', 'posate', 'lampadin', 'pile', 'batterie', 'duracell', 'insetticid', 'zanzar', 'deodorante ambient', 'profumatore',
        'panno', 'panni', 'scopa', 'mocio', 'guanti', 'finish', 'dixan', 'dash', 'ariel', 'omino bianco', 'vernel', 'coccolino', 'lenor', 'svelto', 'nelsen', 'pril',
        'fairy', 'chanteclair', 'ace', 'smac', 'mastro lindo', 'cif', 'vim', 'lysoform', 'napisan', 'bref', 'wc net', 'swiffer', 'vileda', 'glad', 'cuki', 'sacchi gelo',
        'gelo', 'freezer', 'stoviglie', 'piatti', 'microfibra', 'accendino', 'fiammiferi', 'candele', 'tovaglia'],
      f: [] },
    { name: 'Igiene personale', icon: '🧴',
      t: ['shampoo', 'bagnoschiuma', 'docciaschiuma', 'dentifric', 'deodorant', 'sapone'],
      w: ['spazzolin', 'collutorio', 'filo interdentale', 'assorbent', 'proteggislip', 'salvaslip', 'tampon', 'rasoi', 'rasoio', 'lamette', 'schiuma barba', 'dopobarba',
        'cotton fioc', 'cotone', 'dischetti', 'struccant', 'crema mani', 'crema viso', 'crema corpo', 'crema solare', 'balsamo', 'maschera capelli', 'lacca', 'gel capelli',
        'tinta', 'cerotti', 'disinfettante', 'salviette struccanti', 'salviette intime', 'intimo', 'colgate', 'mentadent', 'az', 'oral b', 'gillette', 'pantene',
        'head shoulders', 'vidal', 'neutro roberts', 'nivea', 'dove', 'lines', 'tampax', 'nuvenia', 'lines seta', 'chilly', 'felce azzurra', 'borotalco', 'palmolive',
        'garnier', 'l oreal', 'testanera', 'sensodyne', 'listerine', 'pettine', 'trucco', 'smalto'],
      f: [] },
    { name: 'Bambini', icon: '🍼',
      t: ['pannolin', 'omogeneizz', 'neonat', 'infanzia', 'plasmon', 'mellin', 'humana', 'aptamil'],
      w: ['biberon', 'ciuccio', 'tettarella', 'pampers', 'huggies', 'chicco', 'plasmon', 'mellin', 'humana', 'aptamil', 'latte crescita', 'latte di crescita',
        'pappa', 'pappe', 'liofilizzat', 'salviette bimbi', 'salviette baby', 'baby', 'bimbi', 'bimbo', 'prima infanzia', 'babygella'],
      f: [] },
    { name: 'Animali', icon: '🐾',
      t: ['cane', 'cani', 'gatto', 'gatti', 'pet', 'animali'],
      w: ['crocchett', 'lettiera', 'sabbietta', 'umido', 'bocconcini cane', 'bocconcini gatto', 'whiskas', 'friskies', 'purina', 'felix', 'gourmet', 'monge', 'schesir',
        'almo', 'pedigree', 'sheba', 'trainer', 'royal canin', 'cesar', 'kitekat', 'catisfaction', 'dentastix', 'antiparassitario'],
      f: [] }
  ];

  // Parole che non dicono nulla sul prodotto (misure, confezioni, qualità)
  const STOP = new Set(['kg', 'gr', 'g', 'ml', 'cl', 'lt', 'l', 'pz', 'pezzi', 'x', 'conf', 'confezione', 'busta', 'vasch', 'vaschetta', 'bio', 'biologico', 'off', 'offerta',
    'promo', 'sconto', 'il', 'la', 'le', 'lo', 'di', 'da', 'del', 'della', 'al', 'alla', 'con', 'e', 'in', 'per', 'cat', 'n', 'nr',
    'grande', 'grandi', 'piccolo', 'mini', 'maxi', 'classico', 'classica', 'gusto', 'gusti', 'sfuso', 'sfusi', 'sfusa', 'italia', 'italiano',
    'italiana', 'qualita', 'scelta', 'extra', 'super', 'light', 'zero', 'senza', 'gluten', 'free', 'dop', 'igp', 'stg', 'sacco', 'rete', 'cassetta', 'cf', 'tp']);
  // "zero" (Coca Zero) è utile solo insieme a coca: lo gestisce la parola coca

  // Gusti e ingredienti comuni: valgono poco se c'è un tipo di prodotto
  const FLAVORS = new Set(['fragola', 'fragole', 'pesca', 'albicocca', 'limone', 'arancia', 'mela', 'banana', 'frutti', 'bosco', 'cioccolato', 'nocciola', 'nocciole',
    'vaniglia', 'caffe', 'cocco', 'mango', 'ananas', 'ciliegia', 'menta', 'miele', 'cereali', 'pomodoro', 'basilico', 'funghi', 'tartufo', 'pollo', 'tonno', 'salmone',
    'prosciutto', 'formaggio', 'mozzarella', 'olive', 'olio', 'latte', 'latt', 'uova', 'uovo', 'integrale', 'pistacchio', 'mandorle']);

  // Reparti le cui parole "tipo" decidono sempre (es. SNACK CANE è per animali, non uno snack)
  const STRONG = new Set(['Animali', 'Bambini']);

  // Indice delle parole (costruito una volta sola, vedi buildIndex)
  const SINGLE = [];  // [radice, reparto, peso]
  const PHRASES = []; // [[parole], reparto, peso, testo]

  /** Nome del prodotto pulito e diviso in parole. */
  function tokens(name) {
    return U.norm(name)
      .replace(/(\d)[.,](\d)/g, '$1$2')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(w => w && !/^\d/.test(w) && !STOP.has(w));
  }

  function buildIndex() {
    for (const d of DEPARTMENTS) {
      for (const [list, base] of [[d.t || [], 3], [d.w || [], 2], [d.f || [], 1]]) {
        const weight = base === 3 && STRONG.has(d.name) ? 4 : base;
        for (const raw of list) {
          const all = U.norm(raw).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
          const parts = all.filter(w => !STOP.has(w));
          if (!parts.length) continue;
          // "sardine in", "filetti di": senza la parola di collegamento diventerebbero troppo generiche
          if (all.length > 1 && parts.length === 1) continue;
          if (parts.length === 1) SINGLE.push([parts[0], d.name, weight]);
          else PHRASES.push([parts, d.name, weight, parts.join(' ')]);
        }
      }
    }
  }
  buildIndex();

  /** Chiave del prodotto per ricordare le correzioni (senza pesi e quantità). */
  function key(name) {
    return tokens(name).filter(w => w.length > 1).join(' ');
  }

  /** Distanza di modifica limitata (per tollerare un errore dell'OCR). */
  function close(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, diff = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return diff + (a.length - i) + (b.length - j) <= 1;
  }

  /**
   * Quanto bene la parola dello scontrino "w" corrisponde alla voce "k":
   * 3 = uguale, 2 = radice (k è l'inizio di w), 1.5 = abbreviazione (w è
   * l'inizio di k), 1 = un errore di lettura; 0 = no.
   */
  function wordMatch(w, k) {
    if (w === k) return 3;
    if (k.length >= 3 && w.startsWith(k)) return 2;
    if (w.length >= 3 && k.startsWith(w) && w.length >= Math.min(4, k.length - 1)) return 1.5;
    if (w.length >= 6 && k.length >= 6 && close(w, k)) return 1;
    return 0;
  }

  /**
   * Reparto di un prodotto. Restituisce { department, source, keyword, confidence }.
   * learned = { products: {chiave: reparto}, words: {parola: reparto} } (correzioni tue)
   */
  function classify(name, learned) {
    const L = learned || {};
    const k = key(name);
    if (L.products && L.products[k]) return { department: L.products[k], source: 'learned', keyword: k, confidence: 'alta' };
    const toks = tokens(name);
    if (L.words) {
      for (const t of toks) if (L.words[t]) return { department: L.words[t], source: 'learned-word', keyword: t, confidence: 'alta' };
    }
    // 1) Per ogni parola dello scontrino, tutte le voci del dizionario che le corrispondono
    const perToken = toks.map(() => []);
    for (const [parts, dep, weight, text] of PHRASES) {
      for (let i = 0; i + parts.length <= toks.length; i++) {
        if (parts.every((p, k) => wordMatch(toks[i + k], p) >= 2)) {
          for (let k = 0; k < parts.length; k++) perToken[i + k].push({ dep, weight, quality: 3.5, len: text.length, kw: text, pos: i });
        }
      }
    }
    toks.forEach((w, pos) => {
      for (const [stem, dep, weight] of SINGLE) {
        const q = wordMatch(w, stem);
        if (q) perToken[pos].push({ dep, weight, quality: q, len: stem.length, kw: stem, pos });
      }
    });
    // 2) Per ogni parola si tiene la voce PIÙ SPECIFICA: prima la corrispondenza
    //    migliore (frase > uguale > radice > abbreviazione), poi la voce più lunga.
    //    Gli errori di lettura (fuzzy) contano solo se non c'è niente di meglio.
    let best = null;
    perToken.forEach((cands, pos) => {
      if (!cands.length) return;
      const solid = cands.some(c => c.quality > 1) ? cands.filter(c => c.quality > 1) : cands;
      const c = solid.sort((a, b) => b.quality - a.quality || b.len - a.len)[0];
      // Un gusto/ingrediente dopo la prima parola vale poco (es. "yogurt FRAGOLA", "tavoletta LATTE")
      const weight = pos > 0 && FLAVORS.has(c.kw) ? Math.min(c.weight, 1) : c.weight;
      // 3) Tra le parole vince il peso (tipo > prodotto/marca > gusto), poi chi viene prima
      //    (in italiano il prodotto viene prima: "mozzarella PER PIZZA"), poi la qualità
      const score = weight * 100 - c.pos * 10 + c.quality;
      if (!best || score > best.score) best = { department: c.dep, score, keyword: c.kw, weight };
    });
    if (!best) return { department: 'Altro', source: 'none', keyword: '', confidence: 'bassa' };
    return { department: best.department, source: 'dictionary', keyword: best.keyword, confidence: best.weight >= 2 ? 'alta' : 'media' };
  }

  function icon(dep) {
    const d = DEPARTMENTS.find(x => x.name === dep);
    return d ? d.icon : '❓';
  }

  const NAMES = DEPARTMENTS.map(d => d.name).concat('Altro');

  const Products = { DEPARTMENTS, NAMES, classify, tokens, key, icon };
  root.Products = Products;
  if (typeof module !== 'undefined') module.exports = Products;
})(typeof window === 'undefined' ? globalThis : window);
