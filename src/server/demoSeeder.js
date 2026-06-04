import { customAlphabet } from 'nanoid';
import db from './db.js';
import { createSalt, hashPassphrase } from './auth.js';

const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

// Mock data pools matching the schema's identity fields
const mockGenders = ['Woman', 'Man', 'Non-binary', 'Genderqueer', 'Agender', 'Transgender'];
const mockOrientations = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer'];
const mockRoles = ['Dominant', 'Submissive', 'Switch', 'Top', 'Bottom', 'Versatile'];

// Mad Libs text generation fragments
const textFragments = {
  actions: [
    "I wish to find someone to explore",
    "I wish to connect with people who share my love for",
    "I wish for a deep, meaningful conversation about",
    "I wish to find a partner for",
    "I'm looking for a community interested in",
    "I wish someone would teach me more about",
    "I wish to meet people who enjoy",
    "I wish for a dedicated buddy for"
  ],
  subjects: [
    "local hiking trails",
    "indie tabletop games",
    "classic science fiction and fantasy novels",
    "swing dancing",
    "sustainable energy and electric vehicles",
    "cryptography and logic puzzles",
    "perfecting the art of brewing coffee",
    "spontaneous weekend road trips",
    "authentic cooking and culinary experiments",
    "navigating recent life transitions"
  ],
  contexts: [
    "over the weekend.",
    "in a safe, communicative environment.",
    "over a cup of perfectly brewed coffee.",
    "while hanging out with our cats.",
    "during a quiet evening at home.",
    "with good company and a relaxed vibe.",
    "and see where the adventure takes us.",
    "without any pressure or expectations."
  ]
};

// Helper to grab 1-2 random items from an array
function getRandom(arr, maxCount = 2) {
  const count = Math.floor(Math.random() * maxCount) + 1;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper to generate a random Mad Libs wish
function generateMadLibsWish() {
  const action = textFragments.actions[Math.floor(Math.random() * textFragments.actions.length)];
  const subject = textFragments.subjects[Math.floor(Math.random() * textFragments.subjects.length)];
  const context = textFragments.contexts[Math.floor(Math.random() * textFragments.contexts.length)];
  return `${action} ${subject} ${context}`;
}

export function generateDemoData() {
  // 1. Clear existing demo/user data (Keep the default admin!)
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM wishes').run();
  db.prepare("DELETE FROM users WHERE role != 'admin'").run();

  const users = [];
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 2. Generate 50 simulated users
  for (let i = 1; i <= 50; i++) {
    const id = idGenerator();
    const username = `demo_user_${i}`;
    const salt = createSalt();
    const hash = hashPassphrase('demo-password', salt); 
    
    // Generate random identities
    const genders = JSON.stringify(getRandom(mockGenders));
    const orientations = JSON.stringify(getRandom(mockOrientations));
    const roles = JSON.stringify(getRandom(mockRoles));
    const createdAt = new Date().toISOString();

    insertUser.run(id, username, hash, salt, 'user', genders, orientations, roles, createdAt);
    
    // Keep in memory to assign wishes later
    users.push({ id, genders, orientations, roles }); 
  }

  const insertWish = db.prepare(`
    INSERT INTO wishes (
      id, user_id, content, 
      creator_genders, creator_orientations, creator_roles, 
      desired_genders, desired_orientations, desired_roles, 
      created_at, updated_at, flagged
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 3. Distribute 100 wishes randomly across the 50 users
  for (let i = 0; i < 100; i++) {
    const id = idGenerator();
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const content = generateMadLibsWish();
    
    // Randomize what this wish is looking for
    const desiredGenders = JSON.stringify(getRandom(mockGenders, 3));
    const desiredOrientations = JSON.stringify(getRandom(mockOrientations, 3));
    const desiredRoles = JSON.stringify(getRandom(mockRoles, 3));
    
    // Stagger dates over the last 30 days
    const timeOffset = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
    const date = new Date(Date.now() - timeOffset).toISOString();

    insertWish.run(
      id,
      randomUser.id,
      content,
      randomUser.genders,        
      randomUser.orientations,
      randomUser.roles,
      desiredGenders,            
      desiredOrientations,
      desiredRoles,
      date,                      
      date,                      
      0                          
    );
  }

  return { usersCreated: 50, wishesCreated: 100 };
}