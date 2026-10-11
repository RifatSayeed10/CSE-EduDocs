import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MongoClient, Db } from "mongodb";
import { config } from "./server-config";
import { User, Paper, Project, Topic, Researcher, DatabaseState, FAQItem, SiteBranding, StoredUser } from "./src/types";

const DB_FILE_PATH = config.DB_BACKUP_FILE;

const initialProjects: Project[] = [
  {
    id: "proj_iot_agri",
    title: "IoT Smart Agriculture & Automated Drip Irrigation System",
    category: "Hybrid / IoT",
    teamMembers: ["Abrar Hossain (Roll: 1904018)", "Tahsin Ahmed (Roll: 1904022)", "Mubasshira Khan (Roll: 1904035)"],
    supervisor: "Prof. Dr. Mohammad Tariqul Islam",
    batch: "Batch 19 (Session 2019-20)",
    academicYear: 2025,
    description: "An automated solar-powered IoT hardware node deployed for precision agriculture in Pabna. Utilizes ESP32 microcontrollers and LoRa long-range wireless telemetry to measure soil moisture, ambient humidity, temperature, and NPK nutrient levels. Motorized drip irrigation solenoid valves trigger automatically based on moisture thresholds and cloud-synced weather forecast data.",
    techStack: ["ESP32", "LoRaWAN", "Soil Moisture Sensors", "Arduino C++", "Next.js Dashboard", "MQTT Broker", "Solar Charging Circuit"],
    coverImage: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80",
    demoImages: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=800&auto=format&fit=crop&q=80"
    ],
    githubUrl: "https://github.com/pust-cse/smart-agri-iot",
    liveDemoUrl: "https://agri-iot-demo.pust.ac.bd",
    status: "Completed",
    likes: 84,
    views: 920,
    featured: true,
    createdAt: new Date("2025-10-12T10:00:00Z").toISOString()
  },
  {
    id: "proj_exam_portal",
    title: "PUST Automated Exam Hall Seat Plan & Result Management Portal",
    category: "Software",
    teamMembers: ["Sakib Al Hasan (Roll: 2004005)", "Mehedi Hasan (Roll: 2004014)"],
    supervisor: "Dr. Farhana Sarker",
    batch: "Batch 20 (Session 2020-21)",
    academicYear: 2025,
    description: "Comprehensive departmental web application for automating term-final examination seat allotment, preventing adjacent student roll collusion across departments, generating invigilator schedules, and calculating tabulated CGPA grade sheets with secure administrative digital approvals.",
    techStack: ["React 19", "TypeScript", "Node.js", "Express", "PostgreSQL", "Tailwind CSS", "PDF Generation", "Docker"],
    coverImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
    demoImages: [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80"
    ],
    githubUrl: "https://github.com/pust-cse/exam-automation-portal",
    liveDemoUrl: "https://exam-portal.pust.ac.bd",
    status: "Completed",
    likes: 112,
    views: 1450,
    featured: true,
    createdAt: new Date("2025-07-20T14:30:00Z").toISOString()
  },
  {
    id: "proj_gas_rover",
    title: "Autonomous Hazardous Gas Detection & Surveillance Inspection Rover",
    category: "Hardware",
    teamMembers: ["Fahim Faisal (Roll: 1904031)", "Zahin Mahmud (Roll: 1904040)"],
    supervisor: "Prof. Dr. Kamrul Hasan",
    batch: "Batch 19 (Session 2019-20)",
    academicYear: 2024,
    description: "Hardware robotics prototype designed for industrial gas leak inspection, chemical storage monitoring, and hazardous zone reconnaissance. Features a 4WD tracked chassis with differential steering, multi-gas sensor matrix (Methane MQ-4, Carbon Monoxide MQ-7, LPG MQ-2, Hydrogen MQ-8), obstacle avoidance sonar, and real-time live video streaming over encrypted Wi-Fi link to a central ground station.",
    techStack: ["STM32 Nucleo", "Raspberry Pi 4", "MQ-2/MQ-7 Gas Sensors", "Ultrasonic HC-SR04", "L298N Dual H-Bridge", "Python OpenCV", "LiPo 3S Battery"],
    coverImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
    demoImages: [
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80"
    ],
    githubUrl: "https://github.com/pust-cse/gas-surveillance-rover",
    status: "Completed",
    likes: 96,
    views: 1120,
    featured: true,
    createdAt: new Date("2024-11-15T09:15:00Z").toISOString()
  },
  {
    id: "proj_sign_interpreter",
    title: "Bengali Sign Language Interpreter with Embedded Vision & Audio Feedback",
    category: "Hybrid / IoT",
    teamMembers: ["Nusrat Jahan (Roll: 2004032)", "Sharmin Akter (Roll: 2004055)"],
    supervisor: "Dr. Farhana Sarker",
    batch: "Batch 20 (Session 2020-21)",
    academicYear: 2026,
    description: "An assistive technology solution combining camera vision and embedded edge compute. Captures 38 Bengali sign language gestures in real-time using landmark tracking and a lightweight quantized neural network on a Raspberry Pi 5, outputting both on-screen Bangla text and crystal-clear synthesized Bangla audio speech.",
    techStack: ["MediaPipe Hands", "PyTorch Mobile", "Raspberry Pi 5", "TFT LCD Display", "Python", "TTS Audio Module", "I2S DAC Amplifier"],
    coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    demoImages: [
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80"
    ],
    githubUrl: "https://github.com/pust-cse/bd-sign-language-interpreter",
    status: "Ongoing",
    likes: 135,
    views: 1680,
    featured: true,
    createdAt: new Date("2026-01-25T11:00:00Z").toISOString()
  },
  {
    id: "proj_research_platform",
    title: "PUST CSE Digital Research & Project Showcase Archive",
    category: "Software",
    teamMembers: ["Rifat Ahmed (Roll: 2104095)", "Tanvir Hossain (Roll: 2104012)"],
    supervisor: "Prof. Dr. Mohammad Tariqul Islam",
    batch: "Batch 21 (Session 2021-22)",
    academicYear: 2026,
    description: "Unified web platform and digital archive for the Department of CSE, PUST. Offers structured cataloging for undergraduate theses, graduate dissertations, faculty research publications, software repositories, and hardware prototypes with multi-image demo upload galleries and instant search filtering.",
    techStack: ["React 19", "TypeScript", "Tailwind CSS", "Express REST API", "Node.js", "Vite", "MongoDB"],
    coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    demoImages: [
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80"
    ],
    githubUrl: "https://github.com/pust-cse/research-archive-platform",
    liveDemoUrl: "https://cse.pust.ac.bd/archive",
    status: "Completed",
    likes: 178,
    views: 2100,
    featured: true,
    createdAt: new Date("2026-02-18T16:45:00Z").toISOString()
  }
];

const initialTopics: Topic[] = [
  {
    id: "topic_ai_ml",
    name: "Artificial Intelligence & ML",
    description: "Deep learning, NLP, computer vision, reinforcement learning, and LLM fine-tuning.",
    paperCount: 4
  },
  {
    id: "topic_se_systems",
    name: "Software Engineering & Cloud",
    description: "Distributed architectures, microservices, DevOps, automated code testing, and cloud performance.",
    paperCount: 2
  },
  {
    id: "topic_sec_net",
    name: "Cybersecurity & Networks",
    description: "Network security protocols, cryptographic zero-knowledge systems, malware classification, and IoT security.",
    paperCount: 2
  },
  {
    id: "topic_cv_nlp",
    name: "Computer Vision & Bangla NLP",
    description: "Bengali natural language understanding, OCR document scanning, transformer models, and video analytics.",
    paperCount: 3
  },
  {
    id: "topic_data_bio",
    name: "Data Science & Bioinformatics",
    description: "Computational genomics, biomedical signal processing, predictive analytics, and algorithmic modeling.",
    paperCount: 2
  },
  {
    id: "topic_hci_iot",
    name: "HCI & Embedded Systems",
    description: "Assistive robotics, sensor networks, smart agricultural IoT, and human-computer interaction.",
    paperCount: 1
  }
];

const initialResearchers: Researcher[] = [
  {
    id: "res_tariq",
    name: "Prof. Dr. Mohammad Tariqul Islam",
    affiliation: "Department of Computer Science & Engineering",
    position: "Professor & Department Head",
    bio: "Specializing in Distributed Systems, High-Performance Computing, and Cloud Infrastructure.",
    email: "tariqul@cse.dept.edu",
    website: "https://cse.dept.edu/faculty/tariqul",
    profilePhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    paperCount: 4
  },
  {
    id: "res_farhana",
    name: "Dr. Farhana Sarker",
    affiliation: "Department of Computer Science & Engineering",
    position: "Associate Professor",
    bio: "Focuses on Deep Learning, Bengali Natural Language Processing (NLP), and Medical Image Segmentation.",
    email: "farhana.s@cse.dept.edu",
    website: "https://cse.dept.edu/faculty/farhana",
    profilePhoto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    paperCount: 3
  },
  {
    id: "res_kamrul",
    name: "Prof. Dr. Kamrul Hasan",
    affiliation: "Department of Computer Science & Engineering",
    position: "Professor of Cybersecurity",
    bio: "Pioneering research in Cryptographic Protocols, Zero-Knowledge Proofs, Network Intrusion Detection, and Blockchain.",
    email: "kamrul.hasan@cse.dept.edu",
    website: "https://cse.dept.edu/faculty/kamrul",
    profilePhoto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    paperCount: 3
  }
];

const initialPapers: Paper[] = [
  {
    id: "paper_cse_1",
    title: "BanglaBERT-OCR: Transformer-based Document Text Extraction from Degraded Scanned Bengali Archives",
    authors: ["Tanvir Ahmed (Roll: 1904012)", "Sumaiya Rahman (Roll: 1904045)"],
    supervisor: "Dr. Farhana Sarker",
    coSupervisor: "Prof. Dr. Mohammad Tariqul Islam",
    publicationType: "Undergraduate Thesis",
    year: 2026,
    pages: 64,
    views: 890,
    likes: 142,
    downloadsCount: 88,
    categories: ["Computer Vision & Bangla NLP", "Artificial Intelligence & ML"],
    keywords: ["Bangla OCR", "Transformer", "BERT", "Document Analysis", "Bengali NLP", "Scanned Documents"],
    summary: "This undergraduate thesis proposes a custom vision-language transformer architecture specifically fine-tuned for extracting degraded, low-resolution Bengali historical and administrative manuscripts. Achieves 94.2% character accuracy on complex conjunctive characters (Juktakkhor).",
    fileUrl: "/sample-papers/banglabert_ocr_thesis.pdf",
    coverImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2026-02-15T09:00:00Z").toISOString()
  },
  {
    id: "paper_cse_2",
    title: "Lightweight Edge-AI Model for Real-Time Traffic Congestion Prediction in Dhaka Megacity",
    authors: ["Mahmudul Hasan (Roll: 2004088)", "Farzana Akter (Roll: 2004091)"],
    supervisor: "Prof. Dr. Mohammad Tariqul Islam",
    publicationType: "Conference Paper",
    year: 2025,
    pages: 8,
    views: 1240,
    likes: 215,
    downloadsCount: 164,
    categories: ["Artificial Intelligence & ML", "HCI & Embedded Systems"],
    keywords: ["Edge AI", "YOLOv8", "Dhaka Traffic", "Intelligent Transportation", "Computer Vision", "Real-time"],
    summary: "Published in IEEE International Conference on Smart Systems 2025. Proposes a quantized neural network model running on Raspberry Pi and NVIDIA Jetson edge nodes to predict bottleneck congestions 15 minutes in advance using CCTV feeds.",
    fileUrl: "/sample-papers/edge_traffic_dhaka_conf.pdf",
    coverImage: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2025-11-20T11:30:00Z").toISOString()
  },
  {
    id: "paper_cse_3",
    title: "Zero-Knowledge Authentication Protocol for Decentralized Student Academic Credential Verification",
    authors: ["Shakil Hossain (MSc 2024)", "Nafisa Anjum"],
    supervisor: "Prof. Dr. Kamrul Hasan",
    publicationType: "Master's Thesis",
    year: 2025,
    pages: 82,
    views: 740,
    likes: 160,
    downloadsCount: 95,
    categories: ["Cybersecurity & Networks", "Software Engineering & Cloud"],
    keywords: ["Zero-Knowledge Proofs", "zk-SNARKs", "Academic Credentials", "Blockchain", "Identity Privacy"],
    summary: "Master's thesis presenting a privacy-preserving zk-SNARK protocol that allows university students to prove GPA thresholds and graduation credentials to employers without revealing complete transcript history or sensitive PII.",
    fileUrl: "/sample-papers/zk_credential_thesis.pdf",
    coverImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2025-08-10T14:15:00Z").toISOString()
  },
  {
    id: "paper_cse_4",
    title: "Deep Attention ResNet for Automated Detection of Diabetic Retinopathy from Retinal Fundus Scans",
    authors: ["Dr. Farhana Sarker", "Abrar Al-Mamun (Roll: 1804005)", "Sadia Karim"],
    supervisor: "Dr. Farhana Sarker",
    publicationType: "Journal Article",
    year: 2025,
    pages: 14,
    views: 1890,
    likes: 388,
    downloadsCount: 240,
    categories: ["Data Science & Bioinformatics", "Artificial Intelligence & ML"],
    keywords: ["Diabetic Retinopathy", "Medical Imaging", "ResNet", "Attention Mechanism", "Deep Learning", "Fundus"],
    summary: "Published in Journal of Medical Systems & Informatics. Implements dual-attention residual networks for multi-grade classification of diabetic retinopathy, evaluated across 12,000 anonymized hospital fundus images with 97.8% AUC.",
    fileUrl: "/sample-papers/diabetic_retinopathy_journal.pdf",
    coverImage: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2025-05-14T08:45:00Z").toISOString()
  },
  {
    id: "paper_cse_5",
    title: "Microservice Fault Injection & Self-Healing Resilience in High-Load Kubernetes Clusters",
    authors: ["Rafiul Islam (Roll: 1904033)", "Zubair Al Mahmud"],
    supervisor: "Prof. Dr. Mohammad Tariqul Islam",
    publicationType: "Undergraduate Thesis",
    year: 2024,
    pages: 58,
    views: 610,
    likes: 95,
    downloadsCount: 72,
    categories: ["Software Engineering & Cloud", "Cybersecurity & Networks"],
    keywords: ["Kubernetes", "Microservices", "Chaos Engineering", "Self-Healing", "Cloud Systems", "DevOps"],
    summary: "Undergraduate thesis examining automated chaos engineering tests and predictive container auto-scaling under synthetic DDoS and memory leak attacks in distributed microservice topologies.",
    fileUrl: "/sample-papers/kubernetes_resilience_thesis.pdf",
    coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2024-12-05T16:20:00Z").toISOString()
  },
  {
    id: "paper_cse_6",
    title: "Bangla Abstractive Text Summarization using Multi-Head Cross-Lingual Pretrained Encoders",
    authors: ["Nayeem Rahman (Roll: 2004019)", "Dr. Farhana Sarker"],
    supervisor: "Dr. Farhana Sarker",
    publicationType: "Conference Paper",
    year: 2024,
    pages: 6,
    views: 940,
    likes: 175,
    downloadsCount: 110,
    categories: ["Computer Vision & Bangla NLP", "Artificial Intelligence & ML"],
    keywords: ["Bangla NLP", "Text Summarization", "mBART", "BanglaT5", "Sequence-to-Sequence"],
    summary: "Presented at Asian Conference on Natural Language Processing (ACNLP). Evaluates BanglaT5 and mBART fine-tuning on a novel benchmark dataset of 50,000 Bengali national news articles.",
    fileUrl: "/sample-papers/bangla_summarization_conf.pdf",
    coverImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80",
    status: "Active",
    createdAt: new Date("2024-09-18T10:00:00Z").toISOString()
  }
];

const initialFAQs: FAQItem[] = [
  {
    id: "faq_1",
    question: "How do CSE students and faculty upload theses or conference papers?",
    answer: "Click the 'Upload Thesis / Paper' button at the top of the Library or Home page. Select document type (Undergraduate Thesis, MSc Thesis, Conference Paper, Journal), enter student author names, supervisor name, abstract, keywords, and upload the scanned or digital PDF."
  },
  {
    id: "faq_2",
    question: "How does the search engine match papers?",
    answer: "You can search by any keyword matching paper titles, student author names, faculty supervisor names, research tracks/topics, publication types, or abstract keywords instantly."
  },
  {
    id: "faq_3",
    question: "Are scanned thesis PDFs viewable directly in browser?",
    answer: "Yes, every paper has an integrated instant PDF preview modal with self-healing PDF generation and one-click direct download."
  }
];

const initialBranding: SiteBranding = {
  siteName: "CSE EduDocs",
  siteTagline: "Research Papers, Theses & Student Projects Archive",
  logoUrl: "/logo.svg",
  footerText: "Department of Computer Science & Engineering, Pabna University of Science and Technology (PUST), Pabna-6320, Bangladesh.",
  allowRegistration: true,
  emailNotifications: true,
  themeMode: "light"
};


class DBConnection {
  private state: DatabaseState;
  public mongoClient: MongoClient | null = null;
  public mongoDb: Db | null = null;
  public isMongo = false;

  constructor() {
    this.state = {
      users: [],
      papers: [],
      projects: [],
      topics: [],
      researchers: [],
      tickets: [],
      contactMessages: [],
      faqs: [],
      branding: initialBranding
    };
  }

  public async init() {
    // 1. Try to load local file backup first as initial state
    this.load();
    // 2. Attempt to initialize MongoDB connection and load state directly from it
    await this.initMongo();
  }

  private async initMongo() {
    const mongoUri = config.MONGODB_URI;
    const sanitizedUri = config.getSanitizedMongoUri(mongoUri);
    try {
      console.log(`[Database] Connecting to MongoDB at URI: ${sanitizedUri}...`);
      const client = new MongoClient(mongoUri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
      });
      await client.connect();
      this.mongoClient = client;
      this.mongoDb = client.db();
      this.isMongo = true;
      console.log("[Database] Connected successfully to MongoDB! MongoDB is now the primary database.");

      // Verify if database contains existing documents
      const userCount = await this.mongoDb.collection("users").countDocuments();
      if (userCount > 0) {
        console.log("[Database] Found pre-existing documents in MongoDB. Syncing directly from MongoDB as sole source of truth...");
        await this.loadFromMongo();
      } else {
        console.log("[Database] MongoDB database is freshly initialized. Populating with initial seed data...");
        await this.syncStateToMongo();
      }
    } catch (err: any) {
      const sanitizedError = (err?.message || String(err)).replace(/\/\/(.*?):(.*?)@/g, "//$1:******@");
      if (config.REQUIRE_MONGODB) {
        console.error(`[Database] CRITICAL: REQUIRE_MONGODB=true but failed to connect to MongoDB (${sanitizedError}). Application startup aborted.`);
        throw new Error(`MongoDB connection required but failed: ${sanitizedError}`);
      } else {
        console.warn(`[Database] MongoDB not reachable (${sanitizedError}). Running with local JSON database fallback: ${config.DB_BACKUP_FILE}`);
        this.isMongo = false;
        this.mongoDb = null;
        if (this.mongoClient) { this.mongoClient.close().catch(() => {}); this.mongoClient = null; }
      }
    }
  }

  private async loadFromMongo() {
    if (!this.mongoDb) return;
    try {
      const users = await this.mongoDb.collection("users").find({}).toArray();
      const papers = await this.mongoDb.collection("papers").find({}).toArray();
      const projects = await this.mongoDb.collection("projects").find({}).toArray();
      const topics = await this.mongoDb.collection("topics").find({}).toArray();
      const researchers = await this.mongoDb.collection("researchers").find({}).toArray();
      const tickets = await this.mongoDb.collection("tickets").find({}).toArray();
      const contactMessages = await this.mongoDb.collection("contactMessages").find({}).toArray();
      const faqs = await this.mongoDb.collection("faqs").find({}).toArray();
      const chats = await this.mongoDb.collection("chats").find({}).toArray();
      
      const brandingDoc = await this.mongoDb.collection("branding").findOne({ id: "current" });

      const cleanDocs = (arr: any[]) => arr.map(item => {
        const { _id, ...clean } = item;
        return clean;
      });

      this.state.users = cleanDocs(users) as any[];
      this.state.papers = cleanDocs(papers) as any[];
      this.state.projects = cleanDocs(projects) as any[];
      this.state.topics = cleanDocs(topics) as any[];
      this.state.researchers = cleanDocs(researchers) as any[];
      this.state.tickets = cleanDocs(tickets) as any[];
      this.state.contactMessages = cleanDocs(contactMessages) as any[];
      this.state.faqs = cleanDocs(faqs) as any[];
      this.state.chats = cleanDocs(chats) as any[];

      if (brandingDoc) {
        const { _id, id, ...cleanBranding } = brandingDoc as any;
        this.state.branding = cleanBranding;
      }
      this.normalize();

      console.log(`[Database] Loaded successfully from MongoDB: ${this.state.users.length} users, ${this.state.papers.length} publications, ${this.state.projects.length} software/hardware projects.`);
      
      // Keep local backup synchronized
      this.saveLocalBackup();
    } catch (err) {
      console.error("[Database] Critical error loading tables from MongoDB:", err);
      // Do NOT continue with the (empty) local state: the next save would overwrite MongoDB
      throw err;
    }
  }

  public async syncStateToMongo() {
    if (!this.mongoDb) return;
    try {
      const collections = [
        { name: "users", data: this.state.users },
        { name: "papers", data: this.state.papers },
        { name: "projects", data: this.state.projects || [] },
        { name: "topics", data: this.state.topics },
        { name: "researchers", data: this.state.researchers },
        { name: "tickets", data: this.state.tickets },
        { name: "contactMessages", data: this.state.contactMessages },
        { name: "faqs", data: this.state.faqs },
        { name: "chats", data: this.state.chats || [] }
      ];

      for (const col of collections) {
        const dbCol = this.mongoDb.collection(col.name);
        const activeIds: string[] = [];
        const ops: any[] = [];
        for (const item of col.data as any[]) {
          if (item && item.id) {
            activeIds.push(item.id);
            const doc = JSON.parse(JSON.stringify(item));
            delete doc._id;
            ops.push({ replaceOne: { filter: { id: item.id }, replacement: doc, upsert: true } });
          }
        }
        if (ops.length > 0) {
          await dbCol.bulkWrite(ops, { ordered: false });
        }
        // Remove documents that were deleted from the in-memory state
        await dbCol.deleteMany({ id: { $nin: activeIds } });
      }

      // Sync branding
      const brandingCol = this.mongoDb.collection("branding");
      if (this.state.branding) {
        const doc = JSON.parse(JSON.stringify(this.state.branding));
        delete doc._id;
        await brandingCol.updateOne({ id: "current" }, { $set: doc }, { upsert: true });
      }

    } catch (err) {
      console.error("[Database] Failure mirroring schema states to running MongoDB instance:", err);
    }
  }

  private saveLocalBackup() {
    try {
      this.recalculateStats();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.state, null, 2), "utf8");
    } catch (err) {
      console.error("[Database] Backup write failed:", err);
    }
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const data = fs.readFileSync(DB_FILE_PATH, "utf8");
        this.state = JSON.parse(data);
        
        // Make sure every collection exists (older backup files may miss some)
        if (!this.state.projects) this.state.projects = [];
        if (!this.state.tickets) this.state.tickets = [];
        if (!this.state.contactMessages) this.state.contactMessages = [];
        if (!this.state.faqs) this.state.faqs = initialFAQs;
        if (!this.state.branding) this.state.branding = initialBranding;
        if (!this.state.chats) this.state.chats = [];
        this.normalize();

        this.recalculateStats();
      } else {
        // First start: create the initial admin account, topics, FAQs and branding.
        // Demo papers/projects/faculty are only added when SEED_DEMO_DATA=true.
        const adminPassword = config.ADMIN_DEFAULT_PASSWORD || crypto.randomBytes(9).toString("base64url");
        if (!config.ADMIN_DEFAULT_PASSWORD) {
          console.log("==================================================================");
          console.log(`[Setup] Initial admin account: ${config.ADMIN_EMAIL}`);
          console.log(`[Setup] Generated password:    ${adminPassword}`);
          console.log("[Setup] Log in and change this password from your profile page.");
          console.log("==================================================================");
        }

        const seedDemo = config.SEED_DEMO_DATA;
        this.state = {
          users: [
            {
              id: "usr_admin",
              email: config.ADMIN_EMAIL,
              name: "System Administrator",
              role: "admin",
              bookmarks: [],
              isBlocked: false,
              createdAt: new Date().toISOString(),
              passwordHash: this.hashPassword(adminPassword)
            }
          ],
          papers: seedDemo ? initialPapers : [],
          projects: seedDemo ? initialProjects : [],
          topics: initialTopics,
          researchers: seedDemo ? initialResearchers : [],
          tickets: [],
          contactMessages: [],
          faqs: initialFAQs,
          branding: initialBranding,
          chats: []
        };
        this.save();
      }
    } catch (err) {
      console.error("[Database] Could not read the local database file:", err);
    }
  }

  private syncTimer: NodeJS.Timeout | null = null;
  private syncRunning = false;
  private syncPending = false;

  save() {
    try {
      this.recalculateStats();
      // Write to a temp file first, then rename, so a crash never leaves a half-written file
      const tmp = DB_FILE_PATH + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
      fs.renameSync(tmp, DB_FILE_PATH);
    } catch (err) {
      console.error("[Database] Error saving local database file:", err);
    }
    this.scheduleMongoSync();
  }

  // Many saves in a short time (views, likes) are merged into one MongoDB sync
  private scheduleMongoSync() {
    if (!this.isMongo || !this.mongoDb) return;
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.runMongoSync();
    }, 1000);
  }

  private async runMongoSync() {
    if (this.syncRunning) {
      this.syncPending = true;
      return;
    }
    this.syncRunning = true;
    try {
      await this.syncStateToMongo();
    } catch (err) {
      console.error("[Database] Background sync to MongoDB failed:", err);
    } finally {
      this.syncRunning = false;
      if (this.syncPending) {
        this.syncPending = false;
        this.scheduleMongoSync();
      }
    }
  }

  // Flush any pending MongoDB sync (used on shutdown)
  async flush() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.isMongo && this.mongoDb) {
      await this.syncStateToMongo();
    }
  }

  // Fix up records written by older versions of the app
  private normalize() {
    this.state.users.forEach((u: any) => {
      if (u.isBlocked === undefined) u.isBlocked = false;
      if (!Array.isArray(u.bookmarks)) u.bookmarks = [];
      delete u.downloads;
      delete u.resetCode;
      if (u.email && config.ADMIN_EMAILS.includes(u.email.toLowerCase())) {
        u.role = "admin";
      }
    });
    this.state.papers.forEach((p: any) => {
      delete p.price;
      if (p.downloadsCount === undefined) p.downloadsCount = 0;
      if (p.status === undefined) p.status = "Active";
      if (!Array.isArray(p.categories)) p.categories = p.categories ? [p.categories] : [];
      if (!Array.isArray(p.authors)) p.authors = p.authors ? [p.authors] : [];
    });
  }

  private recalculateStats() {
    // Top-up researcher paper counts
    this.state.researchers.forEach(res => {
      res.paperCount = this.state.papers.filter(p => (p.researcherId === res.id || p.authors.includes(res.name)) && p.status === "Active").length;
    });
    // Top-up topic counts
    this.state.topics.forEach(top => {
      top.paperCount = this.state.papers.filter(p => p.categories.includes(top.name) && p.status === "Active").length;
    });
  }

  // New format: "scrypt$<salt>$<hash>" with a random salt per user
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
  }

  verifyPassword(password: string, stored: string | undefined): boolean {
    if (!stored) return false;
    let expected: Buffer;
    let actual: Buffer;
    if (stored.startsWith("scrypt$")) {
      const [, salt, hash] = stored.split("$");
      expected = Buffer.from(hash, "hex");
      actual = crypto.scryptSync(password, salt, expected.length);
    } else {
      // Old format from earlier versions (static salt). Still accepted so existing
      // accounts can log in; the hash is upgraded on the next successful login.
      expected = Buffer.from(stored, "hex");
      actual = crypto.pbkdf2Sync(password, "research_salt_key_static_2026", 1000, 64, "sha512");
    }
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  isLegacyHash(stored: string | undefined): boolean {
    return !!stored && !stored.startsWith("scrypt$");
  }

  getChats() {
    if (!this.state.chats) {
      this.state.chats = [];
    }
    return this.state.chats;
  }

  getUsers(): StoredUser[] { return this.state.users; }
  getPapers() { return this.state.papers; }
  getProjects() {
    if (!this.state.projects) {
      this.state.projects = [];
    }
    return this.state.projects;
  }
  getTopics() { return this.state.topics; }
  getResearchers() { return this.state.researchers; }
  getTickets() { return this.state.tickets; }
  getContactMessages() { return this.state.contactMessages; }
  getFaqs() { return this.state.faqs; }
  getBranding() { return this.state.branding; }

  createToken(user: User): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ 
      id: user.id, 
      email: user.email, 
      name: user.name || "",
      role: user.role, 
      exp: Date.now() + 7 * 86400000 
    })).toString("base64url");
    const tokenInput = `${header}.${payload}`;
    const signature = crypto.createHmac("sha256", config.JWT_SECRET).update(tokenInput).digest("base64url");
    return `${tokenInput}.${signature}`;
  }

  verifyToken(token: string): { id: string; email: string; name?: string; role: 'student' | 'teacher' | 'editor' | 'admin' | 'user' } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [header, payload, signature] = parts;
      const tokenInput = `${header}.${payload}`;
      const expectedSignature = crypto.createHmac("sha256", config.JWT_SECRET).update(tokenInput).digest("base64url");
      const a = Buffer.from(signature);
      const b = Buffer.from(expectedSignature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      
      const parsedPay = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (parsedPay.exp && Date.now() > parsedPay.exp) {
        return null;
      }
      return parsedPay;
    } catch {
      return null;
    }
  }
}

export const dbConnection = new DBConnection();
export const jwtSecret = config.JWT_SECRET;
