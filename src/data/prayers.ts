/**
 * Traditional Catholic prayers in their common US English wording (the forms the USCCB prints).
 * Lines starting "V." and "R." are versicle and response.
 */

export type PrayerGroup = 'Everyday' | 'Through the day' | 'Mary' | 'At Mass' | 'For others';

export interface Prayer {
  slug: string;
  title: string;
  group: PrayerGroup;
  /** Paragraphs, separated by blank lines. */
  text: string;
  /** Shown under the title. */
  note?: string;
  /** Other names a routine might use for this prayer. */
  aliases?: string[];
}

export const PRAYER_GROUPS: PrayerGroup[] = ['Everyday', 'Through the day', 'Mary', 'At Mass', 'For others'];

export const PRAYERS: Prayer[] = [
  {
    slug: 'sign-of-the-cross',
    title: 'Sign of the Cross',
    group: 'Everyday',
    text: 'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
  },
  {
    slug: 'our-father',
    title: 'Our Father',
    group: 'Everyday',
    aliases: ["Lord's Prayer"],
    text: [
      'Our Father, who art in heaven, hallowed be thy name;',
      'thy kingdom come, thy will be done on earth as it is in heaven.',
      'Give us this day our daily bread,',
      'and forgive us our trespasses, as we forgive those who trespass against us;',
      'and lead us not into temptation, but deliver us from evil. Amen.',
    ].join('\n'),
  },
  {
    slug: 'hail-mary',
    title: 'Hail Mary',
    group: 'Everyday',
    text: [
      'Hail Mary, full of grace, the Lord is with thee.',
      'Blessed art thou among women, and blessed is the fruit of thy womb, Jesus.',
      'Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
    ].join('\n'),
  },
  {
    slug: 'glory-be',
    title: 'Glory Be',
    group: 'Everyday',
    text: [
      'Glory be to the Father, and to the Son, and to the Holy Spirit,',
      'as it was in the beginning, is now, and ever shall be, world without end. Amen.',
    ].join('\n'),
  },
  {
    slug: 'apostles-creed',
    title: "Apostles' Creed",
    group: 'Everyday',
    text: [
      'I believe in God, the Father almighty, Creator of heaven and earth,',
      'and in Jesus Christ, his only Son, our Lord,',
      'who was conceived by the Holy Spirit, born of the Virgin Mary,',
      'suffered under Pontius Pilate, was crucified, died and was buried;',
      'he descended into hell; on the third day he rose again from the dead;',
      'he ascended into heaven, and is seated at the right hand of God the Father almighty;',
      'from there he will come to judge the living and the dead.',
      '',
      'I believe in the Holy Spirit, the holy catholic Church, the communion of saints,',
      'the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.',
    ].join('\n'),
  },
  {
    slug: 'morning-offering',
    title: 'Morning Offering',
    group: 'Through the day',
    text: [
      'O Jesus, through the Immaculate Heart of Mary,',
      'I offer you my prayers, works, joys, and sufferings of this day',
      'for all the intentions of your Sacred Heart,',
      'in union with the Holy Sacrifice of the Mass throughout the world,',
      'for the salvation of souls, the reparation for sins, the reunion of all Christians,',
      'and in particular for the intentions of the Holy Father this month. Amen.',
    ].join('\n'),
  },
  {
    slug: 'angelus',
    title: 'Angelus',
    group: 'Through the day',
    note: 'Traditionally prayed at 6 a.m., noon, and 6 p.m. During the Easter season, the Regina Caeli is prayed instead.',
    text: [
      'V. The Angel of the Lord declared unto Mary,',
      'R. And she conceived of the Holy Spirit.',
      'Hail Mary…',
      '',
      'V. Behold the handmaid of the Lord.',
      'R. Be it done unto me according to thy word.',
      'Hail Mary…',
      '',
      'V. And the Word was made flesh,',
      'R. And dwelt among us.',
      'Hail Mary…',
      '',
      'V. Pray for us, O holy Mother of God,',
      'R. That we may be made worthy of the promises of Christ.',
      '',
      'Let us pray. Pour forth, we beseech thee, O Lord, thy grace into our hearts,',
      'that we, to whom the Incarnation of Christ, thy Son, was made known by the message of an Angel,',
      'may by his Passion and Cross be brought to the glory of his Resurrection,',
      'through the same Christ our Lord. Amen.',
    ].join('\n'),
  },
  {
    slug: 'regina-caeli',
    title: 'Regina Caeli',
    group: 'Through the day',
    aliases: ['Queen of Heaven'],
    note: 'Prayed in place of the Angelus from Easter Sunday through Pentecost.',
    text: [
      'Queen of Heaven, rejoice, alleluia.',
      'For he whom you did merit to bear, alleluia,',
      'has risen, as he said, alleluia.',
      'Pray for us to God, alleluia.',
      '',
      'V. Rejoice and be glad, O Virgin Mary, alleluia.',
      'R. For the Lord has truly risen, alleluia.',
      '',
      'Let us pray. O God, who gave joy to the world through the resurrection of thy Son, our Lord Jesus Christ,',
      'grant, we beseech thee, that through the intercession of the Virgin Mary, his Mother,',
      'we may obtain the joys of everlasting life. Through the same Christ our Lord. Amen.',
    ].join('\n'),
  },
  {
    slug: 'grace-before-meals',
    title: 'Grace Before Meals',
    group: 'Through the day',
    aliases: ['Grace'],
    text: 'Bless us, O Lord, and these thy gifts, which we are about to receive from thy bounty, through Christ our Lord. Amen.',
  },
  {
    slug: 'guardian-angel',
    title: 'Guardian Angel Prayer',
    group: 'Through the day',
    aliases: ['Angel of God', 'Guardian Angel'],
    text: [
      'Angel of God, my guardian dear,',
      "to whom God's love commits me here,",
      'ever this day be at my side,',
      'to light and guard, to rule and guide. Amen.',
    ].join('\n'),
  },
  {
    slug: 'examen',
    title: 'Examen',
    group: 'Through the day',
    aliases: ['Daily Examen', 'Examination of Conscience'],
    note: "St. Ignatius's review of the day. Not a fixed text: a few quiet minutes, usually at night.",
    text: [
      '1. Become aware of God’s presence, and ask the Holy Spirit for light.',
      '2. Look back on the day with gratitude: name its gifts.',
      '3. Review the day hour by hour. Where did you meet God? Where did you turn away?',
      '4. Face what went wrong, and ask for forgiveness.',
      '5. Look toward tomorrow, and ask for the grace you will need.',
      '',
      'Close with an Our Father.',
    ].join('\n'),
  },
  {
    slug: 'come-holy-spirit',
    title: 'Come, Holy Spirit',
    group: 'Through the day',
    text: [
      'Come, Holy Spirit, fill the hearts of your faithful and kindle in them the fire of your love.',
      '',
      'V. Send forth your Spirit and they shall be created.',
      'R. And you shall renew the face of the earth.',
      '',
      'Let us pray. O God, who by the light of the Holy Spirit did instruct the hearts of the faithful,',
      'grant that by the same Holy Spirit we may be truly wise and ever enjoy his consolations.',
      'Through Christ our Lord. Amen.',
    ].join('\n'),
  },
  {
    slug: 'act-of-contrition',
    title: 'Act of Contrition',
    group: 'Through the day',
    note: 'Two common forms. Either may be prayed in confession.',
    text: [
      'My God, I am sorry for my sins with all my heart.',
      'In choosing to do wrong and failing to do good, I have sinned against you whom I should love above all things.',
      'I firmly intend, with your help, to do penance, to sin no more, and to avoid whatever leads me to sin.',
      'Our Savior Jesus Christ suffered and died for us. In his name, my God, have mercy. Amen.',
      '',
      'Or:',
      '',
      'O my God, I am heartily sorry for having offended thee,',
      'and I detest all my sins because of thy just punishments,',
      'but most of all because they offend thee, my God, who art all good and deserving of all my love.',
      'I firmly resolve, with the help of thy grace, to sin no more and to avoid the near occasion of sin. Amen.',
    ].join('\n'),
  },
  {
    slug: 'rosary',
    title: 'Rosary',
    group: 'Mary',
    note: 'How to pray it, and the mysteries for each day.',
    text: '',
  },
  {
    slug: 'memorare',
    title: 'Memorare',
    group: 'Mary',
    text: [
      'Remember, O most gracious Virgin Mary,',
      'that never was it known that anyone who fled to thy protection,',
      'implored thy help, or sought thine intercession was left unaided.',
      'Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother.',
      'To thee do I come, before thee I stand, sinful and sorrowful.',
      'O Mother of the Word Incarnate, despise not my petitions,',
      'but in thy mercy hear and answer me. Amen.',
    ].join('\n'),
  },
  {
    slug: 'hail-holy-queen',
    title: 'Hail, Holy Queen',
    group: 'Mary',
    aliases: ['Salve Regina'],
    text: [
      'Hail, holy Queen, Mother of mercy, our life, our sweetness and our hope.',
      'To thee do we cry, poor banished children of Eve.',
      'To thee do we send up our sighs, mourning and weeping in this valley of tears.',
      'Turn then, most gracious advocate, thine eyes of mercy toward us,',
      'and after this our exile show unto us the blessed fruit of thy womb, Jesus.',
      'O clement, O loving, O sweet Virgin Mary.',
      '',
      'V. Pray for us, O holy Mother of God.',
      'R. That we may be made worthy of the promises of Christ.',
    ].join('\n'),
  },
  {
    slug: 'spiritual-communion',
    title: 'Act of Spiritual Communion',
    group: 'At Mass',
    aliases: ['Spiritual Communion'],
    note: 'For when you cannot receive Communion. By St. Alphonsus Liguori.',
    text: [
      'My Jesus, I believe that you are present in the Most Holy Sacrament.',
      'I love you above all things, and I desire to receive you into my soul.',
      'Since I cannot at this moment receive you sacramentally, come at least spiritually into my heart.',
      'I embrace you as if you were already there and unite myself wholly to you.',
      'Never permit me to be separated from you. Amen.',
    ].join('\n'),
  },
  {
    slug: 'anima-christi',
    title: 'Anima Christi',
    group: 'At Mass',
    aliases: ['Soul of Christ', 'Prayer After Communion'],
    note: 'A prayer after Communion.',
    text: [
      'Soul of Christ, sanctify me.',
      'Body of Christ, save me.',
      'Blood of Christ, inebriate me.',
      'Water from the side of Christ, wash me.',
      'Passion of Christ, strengthen me.',
      'O good Jesus, hear me.',
      'Within thy wounds hide me.',
      'Permit me not to be separated from thee.',
      'From the malicious enemy defend me.',
      'In the hour of my death call me,',
      'and bid me come unto thee,',
      'that with thy saints I may praise thee for ever and ever. Amen.',
    ].join('\n'),
  },
  {
    slug: 'st-michael',
    title: 'Prayer to St. Michael',
    group: 'For others',
    aliases: ['St. Michael', 'Saint Michael'],
    text: [
      'Saint Michael the Archangel, defend us in battle.',
      'Be our protection against the wickedness and snares of the devil.',
      'May God rebuke him, we humbly pray,',
      'and do thou, O Prince of the heavenly hosts, by the power of God,',
      'cast into hell Satan, and all the evil spirits,',
      'who prowl about the world seeking the ruin of souls. Amen.',
    ].join('\n'),
  },
  {
    slug: 'eternal-rest',
    title: 'Eternal Rest',
    group: 'For others',
    aliases: ['Prayer for the Dead', 'Faithful Departed'],
    text: [
      'Eternal rest grant unto them, O Lord, and let perpetual light shine upon them.',
      'May they rest in peace. Amen.',
      '',
      'May their souls and the souls of all the faithful departed, through the mercy of God, rest in peace. Amen.',
    ].join('\n'),
  },
];

export const FATIMA_PRAYER =
  'O my Jesus, forgive us our sins, save us from the fires of hell; lead all souls to heaven, especially those in most need of thy mercy.';

export const ROSARY_CLOSING_PRAYER = [
  'Let us pray. O God, whose only begotten Son, by his life, death, and resurrection,',
  'has purchased for us the rewards of eternal life, grant, we beseech thee,',
  'that while meditating on these mysteries of the most holy Rosary of the Blessed Virgin Mary,',
  'we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.',
].join('\n');

export type MysterySet = 'joyful' | 'luminous' | 'sorrowful' | 'glorious';

export const MYSTERIES: Record<MysterySet, { title: string; days: string; mysteries: string[] }> = {
  joyful: {
    title: 'Joyful Mysteries',
    days: 'Monday and Saturday',
    mysteries: ['The Annunciation', 'The Visitation', 'The Nativity', 'The Presentation in the Temple', 'The Finding in the Temple'],
  },
  luminous: {
    title: 'Luminous Mysteries',
    days: 'Thursday',
    mysteries: [
      'The Baptism in the Jordan',
      'The Wedding at Cana',
      'The Proclamation of the Kingdom',
      'The Transfiguration',
      'The Institution of the Eucharist',
    ],
  },
  sorrowful: {
    title: 'Sorrowful Mysteries',
    days: 'Tuesday and Friday',
    mysteries: [
      'The Agony in the Garden',
      'The Scourging at the Pillar',
      'The Crowning with Thorns',
      'The Carrying of the Cross',
      'The Crucifixion and Death',
    ],
  },
  glorious: {
    title: 'Glorious Mysteries',
    days: 'Wednesday and Sunday',
    mysteries: [
      'The Resurrection',
      'The Ascension',
      'The Descent of the Holy Spirit',
      'The Assumption',
      'The Coronation of Mary',
    ],
  },
};

const BY_WEEKDAY: MysterySet[] = ['glorious', 'joyful', 'sorrowful', 'glorious', 'luminous', 'sorrowful', 'joyful'];

/** The mysteries customarily prayed on a weekday (0 = Sunday). */
export function mysteriesFor(weekday: number): MysterySet {
  return BY_WEEKDAY[weekday];
}

export function prayerBySlug(slug: string): Prayer | undefined {
  return PRAYERS.find((p) => p.slug === slug);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bst\b\.?/g, 'saint')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\b(the|a|prayer|to)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/** The library prayer a routine's name refers to ("Angelus", "Daily Examen", "St. Michael"), if any. */
export function prayerForName(name: string): Prayer | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return PRAYERS.find((p) => [p.title, ...(p.aliases ?? [])].some((t) => norm(t) === n));
}
