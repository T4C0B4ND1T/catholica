// Ported verbatim from the previous app's orderOfMassData.ts (Latin text and titles dropped; unused).
import type { ReadingKind } from '@/lib/types';
export type MassPosture = 'stand' | 'sit' | 'kneel' | 'bow' | 'sign_of_cross';
export type MassPart = 'introductory' | 'word' | 'eucharist' | 'concluding';

export interface MassDialogueLine {
  speaker: 'priest' | 'people' | 'deacon' | 'reader' | 'all' | 'rubric';
  text: string;
  isResponse?: boolean;
}

export interface MassStepData {
  id: string;
  part: MassPart;
  partTitle: string;
  title: string;
  posture: MassPosture;
  summary: string;
  rubricNotes?: string;
  dialogue: MassDialogueLine[];
  alternateForms?: { formId: string; formName: string; description: string; dialogue: MassDialogueLine[] }[];
}

export const ORDER_OF_MASS_STEPS: MassStepData[] = [
  {
    "id": "entrance-procession",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "Entrance Procession & Song",
    "posture": "stand",
    "summary": "The priest and ministers process to the altar while the entrance hymn is sung. The priest venerates the altar with a bow and kiss, signifying Christ as the cornerstone of the Church.",
    "rubricNotes": "All stand. When the Entrance Song is concluded, the Priest and the faithful, standing, sign themselves with the Sign of the Cross.",
    "dialogue": [
      {
        "speaker": "rubric",
        "text": "The priest and altar ministers process to the sanctuary while the congregation sings the Entrance Hymn. The priest approaches the altar, bows, and kisses it with reverence."
      }
    ]
  },
  {
    "id": "sign-of-cross-greeting",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "Sign of the Cross & Greeting",
    "posture": "sign_of_cross",
    "summary": "The Mass begins with the invocation of the Holy Trinity. The priest greets the assembly, declaring the presence of Christ among his people.",
    "rubricNotes": "Priest and people make the Sign of the Cross together.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "In the name of the Father, and of the Son, and of the Holy Spirit."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "The grace of our Lord Jesus Christ, and the love of God, and the communion of the Holy Spirit be with you all."
      },
      {
        "speaker": "people",
        "text": "And with your spirit.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "greeting-option-b",
        "formName": "Greeting Option B",
        "description": "Grace to you and peace from God our Father...",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "Grace to you and peace from God our Father and the Lord Jesus Christ."
          },
          {
            "speaker": "people",
            "text": "And with your spirit.",
            "isResponse": true
          }
        ]
      },
      {
        "formId": "greeting-option-c",
        "formName": "Greeting Option C",
        "description": "The Lord be with you",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "The Lord be with you."
          },
          {
            "speaker": "people",
            "text": "And with your spirit.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "penitential-act",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "Penitential Act",
    "posture": "stand",
    "summary": "The faithful acknowledge their sins in humility and ask God for his mercy, preparing their hearts to worthily celebrate the sacred mysteries.",
    "rubricNotes": "A brief pause for silent examination of conscience is observed.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Brethren (brothers and sisters), let us acknowledge our sins, and so prepare ourselves to celebrate the sacred mysteries."
      },
      {
        "speaker": "rubric",
        "text": "A brief pause for silent reflection on our sins."
      },
      {
        "speaker": "all",
        "text": "I confess to almighty God and to you, my brothers and sisters, that I have greatly sinned, in my thoughts and in my words, in what I have done and in what I have failed to do, (strike breast three times) through my fault, through my fault, through my most grievous fault; therefore I ask blessed Mary ever-Virgin, all the Angels and Saints, and you, my brothers and sisters, to pray for me to the Lord our God.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "penitential-form-b",
        "formName": "Form B: Dialogue",
        "description": "Have mercy on us, O Lord...",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "Have mercy on us, O Lord."
          },
          {
            "speaker": "people",
            "text": "For we have sinned against you.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "Show us, O Lord, your mercy."
          },
          {
            "speaker": "people",
            "text": "And grant us your salvation.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life."
          },
          {
            "speaker": "people",
            "text": "Amen.",
            "isResponse": true
          }
        ]
      },
      {
        "formId": "penitential-form-c",
        "formName": "Form C: Invocations with Kyrie",
        "description": "You were sent to heal the contrite of heart...",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "You were sent to heal the contrite of heart: Lord, have mercy."
          },
          {
            "speaker": "people",
            "text": "Lord, have mercy.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "You came to call sinners: Christ, have mercy."
          },
          {
            "speaker": "people",
            "text": "Christ, have mercy.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "You are seated at the right hand of the Father to intercede for us: Lord, have mercy."
          },
          {
            "speaker": "people",
            "text": "Lord, have mercy.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life."
          },
          {
            "speaker": "people",
            "text": "Amen.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "kyrie",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "The Kyrie (Lord, Have Mercy)",
    "posture": "stand",
    "summary": "An ancient Greek chant preserved in the Roman liturgy, pleading for Christ’s boundless mercy upon the world.",
    "rubricNotes": "The Kyrie is said or sung, unless it has already been used in Form C of the Penitential Act.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Lord, have mercy."
      },
      {
        "speaker": "people",
        "text": "Lord, have mercy.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Christ, have mercy."
      },
      {
        "speaker": "people",
        "text": "Christ, have mercy.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Lord, have mercy."
      },
      {
        "speaker": "people",
        "text": "Lord, have mercy.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "gloria",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "Gloria in Excelsis Deo",
    "posture": "stand",
    "summary": "The ancient and venerable hymn of praise sung on Sundays outside of Advent and Lent, echoing the angel song over Bethlehem.",
    "rubricNotes": "Sung or said on Sundays outside Advent and Lent, on Solemnities and Feasts.",
    "dialogue": [
      {
        "speaker": "all",
        "text": "Glory to God in the highest, and on earth peace to people of good will. We praise you, we bless you, we adore you, we glorify you, we give you thanks for your great glory, Lord God, heavenly King, O God, almighty Father.\n\nLord Jesus Christ, Only Begotten Son, Lord God, Lamb of God, Son of the Father, you take away the sins of the world, have mercy on us; you take away the sins of the world, receive our prayer; you are seated at the right hand of the Father, have mercy on us.\n\nFor you alone are the Holy One, you alone are the Lord, you alone are the Most High, Jesus Christ, with the Holy Spirit, in the glory of God the Father. Amen.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "collect-prayer",
    "part": "introductory",
    "partTitle": "Introductory Rites",
    "title": "The Collect (Opening Prayer)",
    "posture": "stand",
    "summary": "The priest gathers (collects) the prayers of the entire congregation into one unified offering to God the Father through Jesus Christ.",
    "rubricNotes": "The Priest says \"Let us pray\" and all pray silently with him for a moment. Then the Priest extends his hands and says the Collect.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Let us pray."
      },
      {
        "speaker": "rubric",
        "text": "All pray silently with the priest for a brief moment."
      },
      {
        "speaker": "priest",
        "text": "[The Priest recites the Collect prayer designated for today's Mass] ... Through our Lord Jesus Christ, your Son, who lives and reigns with you in the unity of the Holy Spirit, God, for ever and ever."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "first-reading",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "First Reading",
    "posture": "sit",
    "summary": "Proclaimed from the Ambo, usually from the Old Testament (or the Acts of the Apostles during Easter season), preparing the assembly for the Gospel.",
    "rubricNotes": "All sit to listen attentively to God’s holy Word.",
    "dialogue": [
      {
        "speaker": "reader",
        "text": "A reading from the [Book of Sacred Scripture proclaimed today].\n\n[The reader proclaims the text of the first reading.]"
      },
      {
        "speaker": "reader",
        "text": "The word of the Lord."
      },
      {
        "speaker": "people",
        "text": "Thanks be to God.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "responsorial-psalm",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "Responsorial Psalm",
    "posture": "sit",
    "summary": "The congregation’s prayerful response to God’s Word, meditating on the inspired words of King David and the biblical psalmists.",
    "rubricNotes": "The psalmist or cantor sings or recites the Psalm; the people repeat the response after each stanza.",
    "dialogue": [
      {
        "speaker": "reader",
        "text": "[The cantor proclaims the Psalm Response, then the people repeat it.]"
      },
      {
        "speaker": "people",
        "text": "[Recite the Psalm Refrain / Response for today’s Mass]",
        "isResponse": true
      },
      {
        "speaker": "reader",
        "text": "[The cantor proclaims the stanzas of the Psalm, pausing for the response.]"
      }
    ]
  },
  {
    "id": "second-reading",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "Second Reading",
    "posture": "sit",
    "summary": "Proclaimed on Sundays and Solemnities from the New Testament Epistles (Letters of St. Paul, Peter, John, James) or the Book of Revelation.",
    "rubricNotes": "All remain seated in reverent contemplation.",
    "dialogue": [
      {
        "speaker": "reader",
        "text": "A reading from the [Letter / Epistles proclaimed today].\n\n[The reader proclaims the second reading.]"
      },
      {
        "speaker": "reader",
        "text": "The word of the Lord."
      },
      {
        "speaker": "people",
        "text": "Thanks be to God.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "gospel-acclamation",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "Gospel Acclamation (Alleluia)",
    "posture": "stand",
    "summary": "All stand to welcome and greet Christ who is about to speak to his flock in the Holy Gospel.",
    "rubricNotes": "All stand. In Lent, the Alleluia is replaced by the Lenten Gospel Acclamation (\"Praise to you, Lord Jesus Christ, King of endless glory!\").",
    "dialogue": [
      {
        "speaker": "all",
        "text": "Alleluia, alleluia.",
        "isResponse": true
      },
      {
        "speaker": "reader",
        "text": "[The cantor chants the Gospel Verse for today]"
      },
      {
        "speaker": "all",
        "text": "Alleluia, alleluia.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "holy-gospel",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "The Holy Gospel",
    "posture": "sign_of_cross",
    "summary": "The pinnacle of the Liturgy of the Word. We mark our forehead, lips, and heart with the cross, praying that the Gospel may remain in our minds, on our lips, and in our hearts.",
    "rubricNotes": "At the introduction, priest and people trace a small cross on forehead, lips, and breast with their thumb.",
    "dialogue": [
      {
        "speaker": "deacon",
        "text": "The Lord be with you."
      },
      {
        "speaker": "people",
        "text": "And with your spirit.",
        "isResponse": true
      },
      {
        "speaker": "deacon",
        "text": "A reading from the holy Gospel according to [Matthew / Mark / Luke / John]."
      },
      {
        "speaker": "rubric",
        "text": "Make the Sign of the Cross with your thumb upon your forehead, lips, and heart."
      },
      {
        "speaker": "people",
        "text": "Glory to you, O Lord.",
        "isResponse": true
      },
      {
        "speaker": "deacon",
        "text": "[The Deacon or Priest proclaims the Holy Gospel.]"
      },
      {
        "speaker": "deacon",
        "text": "The Gospel of the Lord."
      },
      {
        "speaker": "people",
        "text": "Praise to you, Lord Jesus Christ.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "homily",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "The Homily",
    "posture": "sit",
    "summary": "The priest or deacon breaks open the Sacred Scriptures, explaining the mystery celebrated and applying God’s teachings to Christian daily life.",
    "rubricNotes": "All sit in silent attention.",
    "dialogue": [
      {
        "speaker": "rubric",
        "text": "The Bishop, Priest, or Deacon preaches the homily to illuminate the mystery of Christ and nourish the faith of the assembly."
      }
    ]
  },
  {
    "id": "profession-of-faith",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "Profession of Faith (The Creed)",
    "posture": "stand",
    "summary": "The assembly stands to profess the universal Catholic faith handed down from the Apostles and formulated at the Councils of Nicaea (325 AD) and Constantinople (381 AD).",
    "rubricNotes": "At the words \"and by the Holy Spirit was incarnate of the Virgin Mary, and became man\", all bow deeply.",
    "dialogue": [
      {
        "speaker": "all",
        "text": "I believe in one God, the Father almighty, maker of heaven and earth, of all things visible and invisible.\n\nI believe in one Lord Jesus Christ, the Only Begotten Son of God, born of the Father before all ages. God from God, Light from Light, true God from true God, begotten, not made, consubstantial with the Father; through him all things were made. For us men and for our salvation he came down from heaven, (all bow) and by the Holy Spirit was incarnate of the Virgin Mary, and became man.\n\nFor our sake he was crucified under Pontius Pilate, he suffered death and was buried, and rose again on the third day in accordance with the Scriptures. He ascended into heaven and is seated at the right hand of the Father. He will come again in glory to judge the living and the dead and his kingdom will have no end.\n\nI believe in the Holy Spirit, the Lord, the giver of life, who proceeds from the Father and the Son, who with the Father and the Son is adored and glorified, who has spoken through the prophets.\n\nI believe in one, holy, catholic and apostolic Church. I confess one Baptism for the forgiveness of sins and I look forward to the resurrection of the dead and the life of the world to come. Amen.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "apostles-creed",
        "formName": "Apostles' Creed",
        "description": "Traditional baptismal creed, especially used during Lent and Eastertide.",
        "dialogue": [
          {
            "speaker": "all",
            "text": "I believe in God, the Father almighty, Creator of heaven and earth, and in Jesus Christ, his only Son, our Lord, (bow) who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; he descended into hell; on the third day he rose again from the dead; he ascended into heaven, and is seated at the right hand of God the Father almighty; from there he will come to judge the living and the dead.\n\nI believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "universal-prayer",
    "part": "word",
    "partTitle": "Liturgy of the Word",
    "title": "Universal Prayer (Prayer of the Faithful)",
    "posture": "stand",
    "summary": "The royal priesthood of the faithful exercises its intercessory role, praying for the Holy Church, public authorities, those burdened by difficulties, and all people.",
    "rubricNotes": "The intentions are announced from the ambo by a Deacon, reader, or lay member.",
    "dialogue": [
      {
        "speaker": "reader",
        "text": "For our Holy Father Pope Francis, our Bishop, and all the clergy... let us pray to the Lord."
      },
      {
        "speaker": "people",
        "text": "Lord, hear our prayer.",
        "isResponse": true
      },
      {
        "speaker": "reader",
        "text": "For peace throughout the world and the sanctification of all peoples... let us pray to the Lord."
      },
      {
        "speaker": "people",
        "text": "Lord, hear our prayer.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "[The Priest concludes with an oration] ... Through Christ our Lord."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "offertory-preparation-gifts",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Preparation of the Gifts & Altar",
    "posture": "sit",
    "summary": "Bread and wine, along with monetary gifts for the poor and the Church, are brought in procession to the altar. The priest blesses God for the gifts of creation.",
    "rubricNotes": "The Priest takes the paten with the bread and raises it slightly over the altar.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Blessed are you, Lord God of all creation, for through your goodness we have received the bread we offer you: fruit of the earth and work of human hands, it will become for us the bread of life."
      },
      {
        "speaker": "people",
        "text": "Blessed be God for ever.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Blessed are you, Lord God of all creation, for through your goodness we have received the wine we offer you: fruit of the vine and work of human hands, it will become our spiritual drink."
      },
      {
        "speaker": "people",
        "text": "Blessed be God for ever.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "orate-fratres",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Orate Fratres & Prayer over the Offerings",
    "posture": "stand",
    "summary": "The priest washes his hands (lavabo) and calls upon the people to stand and pray that the sacrifice may be pleasing to God the Father.",
    "rubricNotes": "All stand as the Priest begins \"Pray, brethren...\".",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Pray, brethren (brothers and sisters), that my sacrifice and yours may be acceptable to God, the almighty Father."
      },
      {
        "speaker": "people",
        "text": "May the Lord accept the sacrifice at your hands for the praise and glory of his name, for our good and the good of all his holy Church.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "[The Priest recites the Prayer over the Offerings] ... Through Christ our Lord."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "preface-sanctus",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Preface Dialogue & Sanctus",
    "posture": "stand",
    "summary": "The Eucharistic Prayer opens with the ancient dialogue of thanksgiving, culminating in the angelic hymn of Isaiah and the Palm Sunday crowd.",
    "rubricNotes": "All stand during the dialogue. At the conclusion of the Sanctus, all kneel for the Eucharistic Prayer.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "The Lord be with you."
      },
      {
        "speaker": "people",
        "text": "And with your spirit.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Lift up your hearts."
      },
      {
        "speaker": "people",
        "text": "We lift them up to the Lord.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Let us give thanks to the Lord our God."
      },
      {
        "speaker": "people",
        "text": "It is right and just.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "[The Priest chants the Preface of the Mass, giving thanks to the Father through Christ...] and so, with Angels and Archangels, we sing the hymn of your praise:"
      },
      {
        "speaker": "all",
        "text": "Holy, Holy, Holy Lord God of hosts.\nHeaven and earth are full of your glory.\nHosanna in the highest.\nBlessed is he who comes in the name of the Lord.\nHosanna in the highest.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "consecration-eucharistic-prayer",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Institution Narrative & Consecration",
    "posture": "kneel",
    "summary": "The holy center of the Mass. By the power of the Holy Spirit and the words of Christ spoken in persona Christi, the bread and wine become the true Body, Blood, Soul, and Divinity of Jesus Christ.",
    "rubricNotes": "All kneel reverently. The priest extends his hands over the gifts (Epiclesis) and pronounces Christ’s words of Institution.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "TAKE THIS, ALL OF YOU, AND EAT OF IT, FOR THIS IS MY BODY, WHICH WILL BE GIVEN UP FOR YOU."
      },
      {
        "speaker": "rubric",
        "text": "The priest elevates the consecrated Sacred Host for the adoration of the faithful, then genuflects."
      },
      {
        "speaker": "priest",
        "text": "TAKE THIS, ALL OF YOU, AND DRINK FROM IT, FOR THIS IS THE CHALICE OF MY BLOOD, THE BLOOD OF THE NEW AND ETERNAL COVENANT, WHICH WILL BE POURED OUT FOR YOU AND FOR MANY FOR THE FORGIVENESS OF SINS. DO THIS IN MEMORY OF ME."
      },
      {
        "speaker": "rubric",
        "text": "The priest elevates the Precious Blood in the chalice for the adoration of the faithful, then genuflects."
      }
    ]
  },
  {
    "id": "mystery-of-faith",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "The Mystery of Faith (Memorial Acclamation)",
    "posture": "kneel",
    "summary": "The priest introduces the central mystery of our redemption, and the faithful acclaim Christ’s Death, Resurrection, and Second Coming.",
    "rubricNotes": "All remain kneeling in adoration.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "The mystery of faith."
      },
      {
        "speaker": "people",
        "text": "We proclaim your Death, O Lord, and profess your Resurrection until you come again.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "memorial-option-2",
        "formName": "Option 2: When we eat this Bread",
        "description": "When we eat this Bread and drink this Cup...",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "The mystery of faith."
          },
          {
            "speaker": "people",
            "text": "When we eat this Bread and drink this Cup, we proclaim your Death, O Lord, until you come again.",
            "isResponse": true
          }
        ]
      },
      {
        "formId": "memorial-option-3",
        "formName": "Option 3: Save us, Savior of the world",
        "description": "Save us, Savior of the world...",
        "dialogue": [
          {
            "speaker": "priest",
            "text": "The mystery of faith."
          },
          {
            "speaker": "people",
            "text": "Save us, Savior of the world, for by your Cross and Resurrection you have set us free.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "doxology-great-amen",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "The Doxology & Great Amen",
    "posture": "kneel",
    "summary": "The climax of the Eucharistic Prayer. Holding the paten and chalice aloft, the priest offers all praise to the Holy Trinity. The people respond with the loud and triumphant \"Great Amen\".",
    "rubricNotes": "The Priest elevates the Paten and the Chalice together.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Through him, and with him, and in him, O God, almighty Father, in the unity of the Holy Spirit, all glory and honor is yours, for ever and ever."
      },
      {
        "speaker": "people",
        "text": "AMEN.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "lords-prayer",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "The Lord's Prayer (Our Father)",
    "posture": "stand",
    "summary": "United as the family of God, the faithful stand to recite the prayer taught by Jesus Christ himself, praying for daily bread and forgiveness.",
    "rubricNotes": "All stand. The Priest invites the faithful with hands joined, then extends his hands as all pray together.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "At the Savior’s command and formed by divine teaching, we dare to say:"
      },
      {
        "speaker": "all",
        "text": "Our Father, who art in heaven,\nhallowed be thy name;\nthy kingdom come,\nthy will be done\non earth as it is in heaven.\nGive us this day our daily bread,\nand forgive us our trespasses,\nas we forgive those who trespass against us;\nand lead us not into temptation,\nbut deliver us from evil.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "Deliver us, Lord, we pray, from every evil, graciously grant peace in our days, that, by the help of your mercy, we may be always free from sin and safe from all distress, as we await the blessed hope and the coming of our Savior, Jesus Christ."
      },
      {
        "speaker": "people",
        "text": "For the kingdom, the power and the glory are yours now and for ever.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "sign-of-peace",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "The Rite of Peace",
    "posture": "stand",
    "summary": "The Church asks for peace and unity for herself and the whole human family, and the faithful exchange a sign of fraternal communion.",
    "rubricNotes": "The Priest extends and joins his hands, saying peace to the people.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Lord Jesus Christ, who said to your Apostles: Peace I leave you, my peace I give you, look not on our sins, but on the faith of your Church, and graciously grant her peace and unity in accordance with your will. Who live and reign for ever and ever."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "The peace of the Lord be with you always."
      },
      {
        "speaker": "people",
        "text": "And with your spirit.",
        "isResponse": true
      },
      {
        "speaker": "deacon",
        "text": "Let us offer each other the sign of peace."
      },
      {
        "speaker": "rubric",
        "text": "All exchange a reverent sign of peace (e.g. handshake, slight bow, or saying \"Peace be with you\")."
      }
    ]
  },
  {
    "id": "fraction-agnus-dei",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Fraction of the Bread & Lamb of God",
    "posture": "kneel",
    "summary": "The priest breaks the consecrated host and places a particle into the chalice (commixtion), signifying the reunification of the Body and Blood of Christ in his glorious Resurrection.",
    "rubricNotes": "All kneel (or stand according to local diocesan practice) and recite or chant the Agnus Dei.",
    "dialogue": [
      {
        "speaker": "all",
        "text": "Lamb of God, you take away the sins of the world, have mercy on us.\nLamb of God, you take away the sins of the world, have mercy on us.\nLamb of God, you take away the sins of the world, grant us peace.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "invitation-to-communion",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Invitation to Holy Communion",
    "posture": "kneel",
    "summary": "Displaying the Sacred Host above the chalice, the priest echoes the words of St. John the Baptist and the Roman centurion, expressing profound unworthiness and trust in Christ’s healing grace.",
    "rubricNotes": "The Priest genuflects, takes the host, and holding it slightly raised above the paten or chalice, shows it to the people.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb."
      },
      {
        "speaker": "all",
        "text": "Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "holy-communion-prayer",
    "part": "eucharist",
    "partTitle": "Liturgy of the Eucharist",
    "title": "Holy Communion & Prayer after Communion",
    "posture": "kneel",
    "summary": "The faithful in state of grace receive the Holy Eucharist. A period of sacred silence ensues for personal contemplation and thanksgiving, followed by the concluding prayer.",
    "rubricNotes": "Communicants bow their head in reverence before receiving.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "The Body of Christ."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      },
      {
        "speaker": "rubric",
        "text": "Period of sacred silence and intimate thanksgiving with the Lord Jesus in the heart."
      },
      {
        "speaker": "priest",
        "text": "Let us pray.\n\n[The Priest recites the Prayer after Communion] ... Through Christ our Lord."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ]
  },
  {
    "id": "final-blessing",
    "part": "concluding",
    "partTitle": "Concluding Rites",
    "title": "Final Blessing",
    "posture": "sign_of_cross",
    "summary": "The priest imparts God’s blessing upon the people, commissioning them to live the Gospel in the world.",
    "rubricNotes": "All stand. Priest extends hands over the people and makes the sign of the cross over them.",
    "dialogue": [
      {
        "speaker": "priest",
        "text": "The Lord be with you."
      },
      {
        "speaker": "people",
        "text": "And with your spirit.",
        "isResponse": true
      },
      {
        "speaker": "priest",
        "text": "May almighty God bless you, the Father, and the Son, and the Holy Spirit."
      },
      {
        "speaker": "people",
        "text": "Amen.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "solemn-blessing",
        "formName": "Solemn Blessing (Episcopal / Feast Days)",
        "description": "Triple invocation with Amen responses.",
        "dialogue": [
          {
            "speaker": "deacon",
            "text": "Bow down for the blessing."
          },
          {
            "speaker": "priest",
            "text": "May the God of all consolation order your days in his peace and grant you the gifts of his blessing."
          },
          {
            "speaker": "people",
            "text": "Amen.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "May he free you always from every disorder and confirm your hearts in his love."
          },
          {
            "speaker": "people",
            "text": "Amen.",
            "isResponse": true
          },
          {
            "speaker": "priest",
            "text": "And may the blessing of almighty God, the Father, and the Son, and the Holy Spirit, come down on you and remain with you for ever."
          },
          {
            "speaker": "people",
            "text": "Amen.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "dismissal",
    "part": "concluding",
    "partTitle": "Concluding Rites",
    "title": "The Dismissal",
    "posture": "stand",
    "summary": "The word \"Mass\" comes from the Latin \"Ite, missa est\" (\"Go, you are sent!\"). The faithful are sent on mission to glorify Christ in their families and daily work.",
    "rubricNotes": "The Deacon or Priest dismisses the people. Then the priest kisses the altar and makes a profound bow with the ministers.",
    "dialogue": [
      {
        "speaker": "deacon",
        "text": "Go forth, the Mass is ended."
      },
      {
        "speaker": "people",
        "text": "Thanks be to God.",
        "isResponse": true
      }
    ],
    "alternateForms": [
      {
        "formId": "dismissal-option-b",
        "formName": "Dismissal Option B",
        "description": "Go and announce the Gospel of the Lord.",
        "dialogue": [
          {
            "speaker": "deacon",
            "text": "Go and announce the Gospel of the Lord."
          },
          {
            "speaker": "people",
            "text": "Thanks be to God.",
            "isResponse": true
          }
        ]
      },
      {
        "formId": "dismissal-option-c",
        "formName": "Dismissal Option C",
        "description": "Go in peace, glorifying the Lord by your life.",
        "dialogue": [
          {
            "speaker": "deacon",
            "text": "Go in peace, glorifying the Lord by your life."
          },
          {
            "speaker": "people",
            "text": "Thanks be to God.",
            "isResponse": true
          }
        ]
      },
      {
        "formId": "dismissal-option-d",
        "formName": "Dismissal Option D",
        "description": "Go in peace.",
        "dialogue": [
          {
            "speaker": "deacon",
            "text": "Go in peace."
          },
          {
            "speaker": "people",
            "text": "Thanks be to God.",
            "isResponse": true
          }
        ]
      }
    ]
  },
  {
    "id": "st-michael-prayer",
    "part": "concluding",
    "partTitle": "Concluding Rites",
    "title": "Prayer to Saint Michael the Archangel",
    "posture": "kneel",
    "summary": "Composed by Pope Leo XIII in 1884, this prayer invokes Saint Michael the Archangel for spiritual defense and the protection of the Church against the snares of the evil one. It is traditionally recited with the faithful following the dismissal.",
    "rubricNotes": "Recited with the assembly following the dismissal or before/after the recessional hymn.",
    "dialogue": [
      {
        "speaker": "all",
        "text": "Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the Heavenly Host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls.\n\nAmen.",
        "isResponse": true
      }
    ]
  }
];

const READING_SLOTS: Record<string, ReadingKind> = {
  'first-reading': 'reading1',
  'responsorial-psalm': 'psalm',
  'second-reading': 'reading2',
  'gospel-acclamation': 'alleluia',
  'holy-gospel': 'gospel',
};

/** Which of the day's reading sections a Mass step shows inline, if any. */
export function readingSlotFor(stepId: string): ReadingKind | null {
  return READING_SLOTS[stepId] ?? null;
}
