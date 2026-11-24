/* =========================================================
   TOTORO IELTS MASTER — CAMBRIDGE LISTENING PARAPHRASE BANK
   ---------------------------------------------------------
   Curated spoken IELTS Listening Word <-> Phrase paraphrases
   with authentic Antonym Traps (bẫy trái nghĩa / phủ định)
   for Active-Thinking Test 2 & Audio-First Listening Speed Quiz.
   ========================================================= */
(function () {
  'use strict';

  // Format: lemma: [ [spoken paraphrases...], [antonym traps...] ]
  const RAW = {
    // Part 1: Daily Services, Travel, Booking, Jobs, Money
    expensive: [['costs a lot of money', 'quite pricey'], ['very affordable', 'doesn\'t cost much']],
    cheap: [['very reasonably priced', 'won\'t cost much'], ['far too expensive', 'costs a fortune']],
    free: [['at no extra cost', 'included in the ticket'], ['charges a small fee', 'costs extra to join']],
    discount: [['money off the full price', 'a reduced rate'], ['pay the full amount', 'an extra surcharge']],
    extra: [['additional', 'on top of the usual amount'], ['less than usual', 'left out altogether']],
    reserve: [['book a place in advance', 'hold a spot ahead of time'], ['cancel an existing booking', 'just turn up without booking']],
    arrange: [['set up and organise', 'sort out the details'], ['call off at the last minute', 'leave completely unplanned']],
    nearby: [['just a short walk away', 'right around the corner'], ['miles away from town', 'a long drive out of the area']],
    hire: [['rent for a short period', 'pay to borrow temporarily'], ['buy it permanently', 'sell off old equipment']],
    casual: [['relaxed and informal', 'part-time or temporary work'], ['strictly formal', 'a permanent full-time contract']],
    definitely: [['without any doubt', 'for certain'], ['probably not', 'still completely undecided']],
    double: [['twice as much', 'for two people'], ['cut in half', 'for a single person only']],
    clean: [['spotless and tidy', 'free from dirt'], ['dirty and untidy', 'covered in dust']],
    fine: [['acceptable and suitable', 'a money penalty for breaking rules'], ['completely unacceptable', 'a free reward']],
    nice: [['pleasant and enjoyable', 'lovely to spend time in'], ['unpleasant and awful', 'horrible experience']],
    beautiful: [['stunning to look at', 'very attractive scenery'], ['ugly and dull', 'an eyesore']],
    success: [['worked out really well', 'achieved what was planned'], ['a complete failure', 'ended badly']],
    review: [['look back over carefully', 'feedback from customers'], ['ignore without checking', 'skip past completely']],
    employment: [['paid work or a job', 'working for a company'], ['being out of work', 'unemployment']],
    employee: [['a member of staff', 'someone working for the firm'], ['the company owner', 'an outside customer']],
    communication: [['keeping in touch', 'passing information clearly'], ['total silence', 'cutting off contact']],
    serve: [['look after customers', 'provide food or service'], ['turn customers away', 'refuse service']],
    lock: [['keep securely fastened', 'shut safely with a key'], ['leave wide open', 'unlock for anyone']],
    holiday: [['time off work to relax', 'going away on vacation'], ['a regular working week', 'working overtime']],
    weekend: [['Saturday and Sunday', 'the two days off at the end of the week'], ['midweek working days', 'Monday to Friday']],
    budget: [['the amount of money available', 'spending limit'], ['unlimited funds', 'spending without any limit']],
    refund: [['get your money back', 'return the payment'], ['strictly non-refundable', 'pay an additional fee']],
    deposit: [['pay part of the cost upfront', 'an initial holding payment'], ['pay nothing in advance', 'get a full refund']],
    cancel: [['call off the event', 'won\'t be going ahead'], ['confirm it will run', 'bring the date forward']],
    postpone: [['put off until a later date', 'push back the schedule'], ['bring forward earlier', 'run right on time']],
    annual: [['takes place once a year', 'every twelve months'], ['held every single week', 'a one-off event']],
    weekly: [['happening once every seven days', 'every week'], ['once a year only', 'hardly ever held']],
    monthly: [['once every four weeks', 'at the start of each month'], ['every single day', 'once every few years']],
    delay: [['running behind schedule', 'held up for a while'], ['departing right on time', 'arriving ahead of schedule']],
    available: [['free to book or use', 'still has spaces left'], ['completely booked out', 'no longer on offer']],
    full: [['no spaces left at all', 'completely sold out'], ['plenty of empty seats', 'still wide open']],
    early: [['ahead of the usual time', 'before it gets crowded'], ['running behind schedule', 'late in the day']],
    late: [['after the planned time', 'towards the end of the day'], ['well ahead of time', 'first thing in the morning']],
    beginner: [['no previous experience needed', 'just starting out'], ['for experienced players only', 'advanced level required']],
    experienced: [['has done it for years', 'already skilled'], ['completely new to it', 'a total beginner']],
    temporary: [['only for a short while', 'not meant to last'], ['staying there for good', 'a permanent fixture']],
    permanent: [['there to stay long-term', 'lasting indefinitely'], ['just for a few weeks', 'only a temporary setup']],
    compulsory: [['everyone has to attend', 'strictly required'], ['completely optional', 'entirely up to you']],
    optional: [['entirely up to you', 'not required to join'], ['mandatory for everyone', 'strictly compulsory']],
    strict: [['rules are enforced tightly', 'no exceptions allowed'], ['very relaxed and flexible', 'anything goes']],
    flexible: [['can adjust to suit your schedule', 'easy to change'], ['fixed with no changes allowed', 'very rigid']],
    crowded: [['packed with visitors', 'hardly any room to move'], ['almost completely empty', 'very quiet and deserted']],
    busy: [['full of activity', 'lots of people around'], ['completely quiet', 'hardly anyone there']],
    quiet: [['peaceful with little noise', 'calm atmosphere'], ['noisy and bustling', 'crowded with traffic']],
    popular: [['well liked by visitors', 'always in high demand'], ['rarely visited by anyone', 'unpopular with locals']],
    safe: [['free from danger', 'well protected for visitors'], ['quite hazardous', 'risky and unsafe']],
    afraid: [['worried or nervous about', 'scared of something'], ['completely fearless', 'confident and relaxed']],
    comfortable: [['cosy and relaxing', 'pleasant to sit or stay in'], ['stiff and awkward', 'cramped and unpleasant']],
    regular: [['happening on a fixed schedule', 'occurring often'], ['just a one-off occasion', 'extremely rare']],
    volunteer: [['help out without pay', 'give your time for free'], ['paid full-time worker', 'refuse to help out']],
    welcome: [['gladly invited to join', 'open to everyone'], ['turned away at the door', 'strictly forbidden']],
    entry: [['getting inside the venue', 'admission to the site'], ['the way out', 'leaving the premises']],
    admission: [['the price to get in', 'entry into a place or course'], ['being refused entry', 'the exit gate']],
    prize: [['something won in a contest', 'an award for coming first'], ['an entry fee you pay', 'a penalty for losing']],
    notice: [['a printed sign on the wall', 'spot or pay attention to'], ['completely overlook', 'miss without seeing']],
    advice: [['helpful suggestions', 'guidance on what to do'], ['a strict order', 'ignoring someone\'s problem']],
    chance: [['a good opportunity', 'possibility of happening'], ['no possibility at all', 'guaranteed failure']],
    aid: [['practical help or support', 'assistance when needed'], ['blocking progress', 'refusing to assist']],
    facility: [['amenities and equipment on site', 'buildings for a service'], ['lack of basic services', 'an empty plot of land']],
    adult: [['grown-ups over eighteen', 'not for young children'], ['young children only', 'under-twelves']],
    local: [['from the surrounding area', 'in the neighbourhood'], ['from overseas', 'imported from abroad']],
    private: [['not open to the general public', 'for members only'], ['open to everyone freely', 'owned by the public']],
    public: [['open for everyone to use', 'accessible to all'], ['restricted to staff only', 'strictly private']],
    convenient: [['easy to reach and use', 'saves time and effort'], ['out of the way and awkward', 'very inconvenient']],
    suitable: [['a good fit for the purpose', 'right for your needs'], ['not appropriate at all', 'completely unsuitable']],
    reasonable: [['fair and not too high', 'makes good sense'], ['far too high', 'completely unfair']],

    // Part 2: Maps, Directions, Redevelopment, Buildings
    relocate: [['move to a brand-new site', 'shift to another spot'], ['stay right where it is', 'close down permanently']],
    convert: [['turn into something new', 'change the use of a space'], ['keep in its original form', 'leave untouched']],
    renovate: [['do up the old building', 'restore and modernise'], ['leave falling apart', 'knock completely down']],
    redevelop: [['rebuild and upgrade the area', 'give the site a whole new layout'], ['preserve exactly as it was', 'abandon the site']],
    enlarge: [['make much bigger', 'expand the floor space'], ['shrink in size', 'cut the area in half']],
    construct: [['build from scratch', 'put up a new structure'], ['tear down completely', 'demolish the building']],
    replace: [['put something new in its place', 'swap out the old one'], ['keep the original one', 'leave as it has always been']],
    opposite: [['directly across from', 'facing on the other side'], ['right next door on the same side', 'tucked far behind']],
    cross: [['go over to the other side', 'walk across the road or bridge'], ['turn back the same way', 'stay on this side']],
    upstairs: [['on the upper level', 'up the staircase'], ['down in the basement', 'on the ground floor']],
    downstairs: [['on the lower floor', 'down at ground level'], ['up on the top floor', 'up on the roof']],
    outdoors: [['in the open air', 'outside the building'], ['inside the main hall', 'completely indoors']],
    indoors: [['inside the building', 'under a roof'], ['out in the open air', 'outside on the lawn']],
    inside: [['within the building', 'through the inner doors'], ['out on the street', 'outside the fence']],
    outside: [['out in the open', 'beyond the main walls'], ['deep inside the building', 'in the inner room']],
    entrance: [['the way in', 'where visitors arrive'], ['the way out', 'the back exit']],
    middle: [['right in the centre', 'halfway between both sides'], ['out along the outer edge', 'tucked in the far corner']],
    bottom: [['at the very lowest part', 'down at the foot of'], ['right at the peak', 'at the very top']],
    top: [['at the highest point', 'on the uppermost level'], ['down at the base', 'at the very bottom']],
    front: [['facing the main road', 'at the forward end'], ['round the back', 'at the rear of the building']],
    corner: [['where two streets or walls meet', 'at the sharp bend'], ['straight down the middle', 'in the open centre']],
    boundary: [['the outer border or fence line', 'where the grounds end'], ['right in the dead centre', 'an inner corridor']],
    surround: [['go all the way around', 'enclose on every side'], ['sit far away from', 'leave completely open']],
    narrow: [['not very wide', 'tight space to pass through'], ['broad and spacious', 'very wide']],
    wide: [['broad with plenty of room', 'stretching far across'], ['tight and cramped', 'very narrow']],
    steep: [['rises sharply uphill', 'a tough climb'], ['completely flat', 'gentle and level']],
    flat: [['level with no hills', 'an apartment on one floor'], ['steep and hilly', 'sloping sharply']],
    ancient: [['hundreds of years old', 'from the distant past'], ['brand new', 'built only recently']],
    modern: [['up to date and contemporary', 'newly designed'], ['old-fashioned and outdated', 'centuries old']],
    urban: [['in the city or town centre', 'built-up area'], ['out in the countryside', 'a quiet rural village']],
    rural: [['out in the countryside', 'far from big cities'], ['in the heart of the city', 'densely urban']],
    curve: [['bend gently to one side', 'wind around'], ['run completely straight', 'a sharp dead end']],
    junction: [['where roads meet and join', 'an intersection'], ['a dead-end lane', 'a single straight stretch']],
    shelter: [['a covered spot out of the rain', 'a place to stay dry'], ['exposed to the wind and rain', 'open uncovered ground']],
    elevator: [['take the lift between floors', 'ride up without stairs'], ['climb the staircase', 'stay on ground level']],
    lift: [['take the elevator', 'raise something up'], ['walk down the stairs', 'drop to the ground']],

    // Part 3: Academic Discussion, Research, Assignments, Attitudes
    discuss: [['talk things through together', 'exchange views on'], ['keep completely silent about', 'avoid bringing up']],
    topic: [['the subject being studied', 'main theme of the paper'], ['an unrelated detail', 'the final deadline']],
    sustainable: [['eco-friendly for the long run', 'doesn\'t use up future resources'], ['wasteful and harmful', 'short-lived and polluting']],
    experiment: [['run a practical test', 'carry out a trial in the lab'], ['guess without testing', 'pure theory only']],
    claim: [['argue that something is true', 'state without full proof'], ['admit it is false', 'deny completely']],
    assignment: [['a piece of coursework to hand in', 'an assessed task'], ['an optional hobby', 'a holiday break']],
    literature: [['published studies on the topic', 'books and academic articles'], ['raw lab equipment', 'unwritten rumours']],
    academic: [['related to university study', 'scholarly research'], ['purely for entertainment', 'informal leisure']],
    regulation: [['an official rule to follow', 'legal guideline'], ['no rules at all', 'complete freedom to ignore']],
    outline: [['a rough plan of main points', 'brief overview structure'], ['every tiny final detail', 'the completed draft']],
    argument: [['a reasoned case for a view', 'disagreement over an issue'], ['complete agreement', 'staying neutral']],
    struggle: [['find it really tough', 'have a hard time managing'], ['breeze through easily', 'handle effortlessly']],
    hardly: [['almost never', 'barely at all'], ['very frequently', 'almost all the time']],
    obvious: [['clear right away', 'easy for anyone to notice'], ['hidden and unclear', 'very hard to spot']],
    strange: [['unusual and unexpected', 'a bit odd'], ['totally ordinary', 'familiar and normal']],
    loneliness: [['feeling isolated from others', 'having no company'], ['surrounded by close friends', 'strong social connection']],
    lonely: [['feeling cut off and alone', 'lacking companionship'], ['well connected socially', 'never by yourself']],
    alone: [['by yourself with no one else', 'without any company'], ['in a large group', 'accompanied by others']],
    nowadays: [['in today\'s world', 'at the present time'], ['back in the distant past', 'centuries ago']],
    yesterday: [['the day before today', 'just one day ago'], ['next week', 'years in the future']],
    credit: [['points toward your degree', 'recognition for good work'], ['losing marks', 'getting zero recognition']],
    dissertation: [['a long final-year research paper', 'major thesis project'], ['a five-minute quiz', 'a brief informal chat']],
    grade: [['the mark you receive', 'assessment score'], ['the course syllabus', 'skipping the exam']],
    research: [['in-depth investigation', 'studying a subject closely'], ['making a wild guess', 'ignoring the evidence']],
    method: [['the approach or technique used', 'way of doing something'], ['a random accident', 'the final conclusion']],
    focus: [['concentrate mainly on', 'pay close attention to'], ['lose sight of', 'get distracted away from']],
    mention: [['bring up briefly', 'refer to in passing'], ['leave out completely', 'keep a secret']],
    prepare: [['get ready in advance', 'plan ahead before starting'], ['improvise with zero planning', 'leave until after']],
    similar: [['almost the same', 'having a lot in common'], ['completely different', 'nothing alike at all']],
    identify: [['recognise and pinpoint', 'spot accurately'], ['fail to recognise', 'mix up with something else']],
    purpose: [['the main reason behind it', 'what it is meant to achieve'], ['a random side effect', 'having no point at all']],
    aim: [['what they hope to achieve', 'the main goal'], ['an unintended mistake', 'giving up completely']],
    likely: [['there\'s a good chance', 'expected to happen'], ['almost impossible', 'highly unlikely']],
    avoid: [['stay well away from', 'steer clear of'], ['actively look for', 'head straight into']],
    wrong: [['incorrect', 'not the right answer'], ['spot on', 'completely accurate']],
    encourage: [['motivate people to try', 'give active support to'], ['discourage from taking part', 'put people off']],
    doubt: [['not really convinced', 'question whether it is true'], ['completely certain', 'believe without question']],
    confirm: [['verify for sure', 'make certain it is right'], ['deny or cancel', 'leave unverified']],
    agree: [['share the same view', 'see eye to eye'], ['strongly disagree', 'reject the idea']],
    disagree: [['hold a different opinion', 'not see eye to eye'], ['fully support the view', 'completely agree']],
    brief: [['short and to the point', 'not taking long'], ['long and drawn out', 'overly detailed']],
    complex: [['complicated with many parts', 'hard to untangle'], ['straightforward and simple', 'easy to follow']],
    simple: [['straightforward and easy', 'not complicated'], ['highly complex', 'very confusing']],
    essential: [['absolutely necessary', 'cannot do without'], ['totally unnecessary', 'easy to skip']],
    reliable: [['can be depended on', 'works consistently well'], ['unpredictable and faulty', 'breaks down often']],
    efficient: [['gets more done with less waste', 'works smoothly and fast'], ['slow and wasteful', 'poorly organised']],
    effective: [['produces the desired result', 'actually works well'], ['makes no difference at all', 'completely useless']],
    useful: [['helpful in practice', 'serves a good purpose'], ['a waste of time', 'completely useless']],
    confident: [['sure of yourself', 'feeling positive about it'], ['nervous and unsure', 'filled with self-doubt']],
    satisfied: [['pleased with the outcome', 'happy with how it went'], ['let down and unhappy', 'disappointed']],

    // Part 4: Academic Lectures, Environment, Science, Economy, Society
    affect: [['have an impact on', 'bring about changes in'], ['leave completely untouched', 'have zero effect on']],
    improve: [['make noticeably better', 'raise the quality of'], ['make things much worse', 'let standards slip']],
    reduce: [['cut down on', 'bring the level lower'], ['increase sharply', 'push figures much higher']],
    increase: [['go up steadily', 'rise in number or level'], ['drop sharply', 'cut back dramatically']],
    decline: [['fall gradually over time', 'go downwards'], ['grow rapidly', 'shoot up sharply']],
    expand: [['grow wider or larger', 'spread into new areas'], ['shrink back down', 'scale way back']],
    protect: [['keep safe from harm', 'guard against damage'], ['leave exposed to danger', 'cause serious harm to']],
    rescue: [['save from a dangerous spot', 'bring back to safety'], ['abandon in trouble', 'put in greater danger']],
    benefit: [['a clear advantage', 'something positive gained'], ['a serious drawback', 'a major disadvantage']],
    major: [['very significant', 'one of the main factors'], ['minor and trivial', 'barely worth noting']],
    common: [['found very frequently', 'seen almost everywhere'], ['extremely rare', 'hardly ever seen']],
    variety: [['a wide range of different types', 'lots of diversity'], ['just one single kind', 'complete uniformity']],
    source: [['where something comes from', 'the original supply'], ['the final destination', 'where waste ends up']],
    amount: [['the total quantity', 'how much there is'], ['the overall quality', 'the exact location']],
    quality: [['how good the standard is', 'level of craftsmanship'], ['sheer quantity only', 'how cheap it is']],
    waste: [['rubbish thrown away', 'use carelessly without need'], ['make full use of', 'conserve carefully']],
    recycle: [['turn used items into new material', 'process for reuse'], ['dump straight into landfill', 'throw away for good']],
    recycling: [['reprocessing used materials', 'turning waste into new goods'], ['burning rubbish once', 'single-use disposal']],
    energy: [['power needed to run things', 'fuel or electricity'], ['complete exhaustion', 'power cut']],
    noise: [['unwanted loud sound', 'disturbing racket'], ['peace and quiet', 'complete silence']],
    store: [['keep safely for later use', 'put away in stock'], ['throw out immediately', 'use up all at once']],
    contain: [['hold inside', 'be made up of'], ['leave out completely', 'spill everything out']],
    create: [['bring into existence', 'produce something new'], ['wipe out completely', 'destroy what exists']],
    particularly: [['especially', 'above all else'], ['least of all', 'hardly at all']],
    financial: [['to do with money and funding', 'economic matters'], ['unrelated to money', 'purely artistic']],
    cultural: [['linked to traditions and arts', 'customs of a society'], ['purely mechanical', 'strictly scientific']],
    electronic: [['powered by digital circuits', 'on a computer or device'], ['written by hand on paper', 'purely manual']],
    freeze: [['turn solid with extreme cold', 'drop below zero degrees'], ['melt in the heat', 'boil over']],
    shortage: [['not enough to meet demand', 'running low on supply'], ['more than enough', 'a huge surplus']],
    surplus: [['more than is needed', 'extra left over'], ['a severe shortage', 'running completely out']],
    ban: [['officially forbid', 'make illegal to use'], ['officially allow', 'encourage everyone to use']],
    allow: [['give permission for', 'let people do'], ['strictly prohibit', 'ban altogether']],
    require: [['must have in order to proceed', 'make necessary'], ['completely optional', 'not needed at all']],
    maintain: [['keep in good working order', 'look after regularly'], ['neglect and let decay', 'abandon completely']],
    neglect: [['fail to look after properly', 'leave uncared for'], ['care for attentively', 'maintain in top shape']],
    estimate: [['work out roughly', 'give an approximate figure'], ['measure to the exact millimetre', 'refuse to guess']],
    limited: [['only a small amount available', 'restricted in number'], ['endless and unrestricted', 'plenty for everyone']],
    accessible: [['easy for everyone to reach', 'open and straightforward to use'], ['cut off and hard to reach', 'blocked to visitors']],
    visible: [['easy to see with the naked eye', 'clearly in view'], ['hidden out of sight', 'completely invisible']],
    significant: [['large enough to matter', 'truly important'], ['tiny and trivial', 'barely noticeable']],
    rapid: [['happening very fast', 'quick pace of change'], ['painfully slow', 'barely moving']],
    gradual: [['happening slowly bit by bit', 'step by step over time'], ['sudden and abrupt', 'happening overnight']],
    abundant: [['available in large quantities', 'plenty of it around'], ['very scarce', 'hardly any left']],
    scarce: [['hard to find', 'in very short supply'], ['plentiful everywhere', 'abundant']],
    fragile: [['breaks very easily', 'delicate and vulnerable'], ['tough and durable', 'built to last']],
    durable: [['strong and long-lasting', 'stands up to heavy wear'], ['breaks easily', 'flimsy and fragile']],
    severe: [['very serious and harsh', 'extreme conditions'], ['mild and gentle', 'hardly noticeable']],
    mild: [['gentle and not extreme', 'fairly warm and pleasant'], ['harsh and extreme', 'severe']],
    initial: [['right at the very start', 'the first stage'], ['at the very end', 'the final outcome']],
    final: [['coming right at the end', 'the last stage'], ['the very first step', 'right at the beginning']],
    previous: [['the one right before', 'earlier in time'], ['the one coming next', 'future']],
    recent: [['happened not long ago', 'fairly new'], ['from centuries ago', 'long outdated']],
    primary: [['the main and most important', 'first in priority'], ['secondary and minor', 'least important']],
    accurate: [['exact and free from errors', 'spot on'], ['full of mistakes', 'wildly inaccurate']],
    diverse: [['full of variety and differences', 'many distinct kinds'], ['all identical', 'only one single type']],
    obvious_check: null,
  };

  delete RAW.obvious_check;

  const map = {};
  const allPhrases = [];
  Object.keys(RAW).forEach((lemma) => {
    const entry = RAW[lemma];
    if (!Array.isArray(entry) || !Array.isArray(entry[0]) || !entry[0].length) return;
    const spoken = entry[0].map((s) => String(s || '').trim()).filter(Boolean);
    const antonymTrap = (Array.isArray(entry[1]) ? entry[1] : []).map((s) => String(s || '').trim()).filter(Boolean);
    if (!spoken.length) return;
    map[lemma.toLowerCase()] = { lemma: lemma.toLowerCase(), spoken, antonymTrap };
    spoken.forEach((p) => allPhrases.push({ lemma: lemma.toLowerCase(), phrase: p }));
  });

  function getEntry(lemma) {
    const k = String(lemma || '').trim().toLowerCase();
    if (!k) return null;
    if (map[k]) return map[k];
    // Handle simple plural / -ed / -ing fallback if exact lemma matches base
    if (k.endsWith('s') && map[k.slice(0, -1)]) return map[k.slice(0, -1)];
    return null;
  }

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Build 4 spoken-paraphrase options for a Listening word:
   * - 1 authentic Cambridge spoken paraphrase (isCorrect: true)
   * - 1 authentic Antonym Trap (isAntonymTrap: true, isCorrect: false)
   * - 2 plausible unrelated spoken phrases from the bank
   */
  function buildParaphraseQuestion(lemma) {
    const entry = getEntry(lemma);
    if (!entry) return null;
    const correctPhrase = entry.spoken[Math.floor(Math.random() * entry.spoken.length)];
    const trapPhrase = entry.antonymTrap.length
      ? entry.antonymTrap[Math.floor(Math.random() * entry.antonymTrap.length)]
      : '';

    const used = new Set([correctPhrase.toLowerCase()]);
    const opts = [{ text: correctPhrase, isCorrect: true, isAntonymTrap: false }];
    if (trapPhrase && !used.has(trapPhrase.toLowerCase())) {
      used.add(trapPhrase.toLowerCase());
      opts.push({ text: trapPhrase, isCorrect: false, isAntonymTrap: true });
    }

    const otherPool = shuffle(allPhrases.filter((x) => x.lemma !== entry.lemma));
    for (const cand of otherPool) {
      if (opts.length >= 4) break;
      const low = cand.phrase.toLowerCase();
      if (used.has(low)) continue;
      used.add(low);
      opts.push({ text: cand.phrase, isCorrect: false, isAntonymTrap: false });
    }
    if (opts.length < 4) return null;
    return {
      lemma: entry.lemma,
      correctPhrase,
      trapPhrase,
      options: shuffle(opts),
    };
  }

  window.APP_LISTENING_PARAPHRASES = {
    map,
    count: Object.keys(map).length,
    getEntry,
    hasEntry: (lemma) => Boolean(getEntry(lemma)),
    buildParaphraseQuestion,
  };
})();
