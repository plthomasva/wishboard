import crypto from 'crypto';
const secureRandom = () => crypto.randomBytes(4).readUInt32LE(0) / 0x100000000;
import { customAlphabet } from 'nanoid';
import db from './db.js';
import { createSalt, hashPassphrase } from './auth.js';

const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

// Mock data pools matching the schema's identity fields
const primaryGenders = ['Woman', 'Man'];
const secondaryGenders = ['Non-binary', 'Genderqueer', 'Agender', 'Transgender', 'Cisgender'];
const mockGenders = [...primaryGenders, ...secondaryGenders];
const mockOrientations = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer'];
const mockRoles = ['Dominant', 'Submissive', 'Switch', 'Top', 'Bottom', 'Versatile'];
const mockContactTypes = ['FetLife', 'Phone', 'Email'];

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
  const count = Math.floor(secureRandom() * maxCount) + 1;
  const shuffled = [...arr].sort(() => 0.5 - secureRandom());
  return shuffled.slice(0, count);
}

function getRandomGenders() {
  const selected = [];
  if (secureRandom() > 0.3) { // 70% chance to have a primary gender
    selected.push(primaryGenders[Math.floor(secureRandom() * primaryGenders.length)]);
  }
  if (secureRandom() > 0.5) { // 50% chance to have a secondary gender
    selected.push(secondaryGenders[Math.floor(secureRandom() * secondaryGenders.length)]);
  }
  return selected;
}

function generateRandomContacts() {
  const count = Math.floor(secureRandom() * 3); // 0 to 2 contacts
  const contacts = [];
  const types = [...mockContactTypes].sort(() => 0.5 - secureRandom());
  for (let i=0; i<count; i++) {
    const type = types[i];
    const value = type === 'Phone' ? '555-010' + Math.floor(secureRandom() * 10) : `demo_${type.toLowerCase()}_${Math.floor(secureRandom()*1000)}`;
    contacts.push({ type, value });
  }
  return contacts;
}

// Helper to generate a random Mad Libs wish
function generateMadLibsWish() {
  const action = textFragments.actions[Math.floor(secureRandom() * textFragments.actions.length)];
  const subject = textFragments.subjects[Math.floor(secureRandom() * textFragments.subjects.length)];
  const context = textFragments.contexts[Math.floor(secureRandom() * textFragments.contexts.length)];
  return `${action} ${subject} ${context}`;
}

export function generateDemoData() {
  // 1. Clear existing demo/user data (Keep the default admin's session)
  // Remove wishes and non-admin users first, then prune sessions that no
  // longer belong to any remaining user (this preserves the admin's session)
  db.prepare('DELETE FROM wishes').run();
  db.prepare("DELETE FROM users WHERE role != 'admin'").run();

  // Remove sessions for user_ids that no longer exist (keeps admin session)
  db.prepare('DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)').run();

  const users = [];
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 2. Generate 50 simulated users
  for (let i = 1; i <= 50; i++) {
    const id = idGenerator();
    const username = `demo_user_${i}`;
    const salt = createSalt();
    const hash = hashPassphrase('demo-password', salt); 
    
    // Generate random identities
    const genders = JSON.stringify(getRandomGenders());
    const orientations = JSON.stringify(getRandom(mockOrientations));
    const roles = JSON.stringify(getRandom(mockRoles));
    const contacts = generateRandomContacts();
    const wishmailEnabledInt = secureRandom() > 0.5 ? 1 : 0;
    const createdAt = new Date().toISOString();

    insertUser.run(id, username, hash, salt, 'user', genders, orientations, roles, JSON.stringify(contacts), wishmailEnabledInt, createdAt);
    
    // Keep in memory to assign wishes later
    users.push({ id, genders, orientations, roles, contacts, wishmailEnabled: wishmailEnabledInt === 1 }); 
  }

  const insertWish = db.prepare(`
    INSERT INTO wishes (
      id, user_id, content, 
      creator_genders, creator_orientations, creator_roles, 
      desired_genders, desired_orientations, desired_roles, 
      contacts, wishmail_enabled,
      created_at, updated_at, flagged
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 3. Distribute 100 wishes randomly across the 50 users
  for (let i = 0; i < 100; i++) {
    const id = idGenerator();
    const randomUser = users[Math.floor(secureRandom() * users.length)];
    const content = generateMadLibsWish();
    
    // Randomize what this wish is looking for, frequently leaving them blank to simulate normal user behavior
    const desiredGenders = secureRandom() > 0.4 ? '[]' : JSON.stringify(getRandom(mockGenders, 2));
    const desiredOrientations = secureRandom() > 0.6 ? '[]' : JSON.stringify(getRandom(mockOrientations, 2));
    const desiredRoles = secureRandom() > 0.7 ? '[]' : JSON.stringify(getRandom(mockRoles, 2));
    
    // Stagger dates over the last 30 days
    const timeOffset = Math.floor(secureRandom() * 30 * 24 * 60 * 60 * 1000);
    const date = new Date(Date.now() - timeOffset).toISOString();

    let wishContacts = [...randomUser.contacts];
    let wishWishmail = randomUser.wishmailEnabled;
    
    // random override for wishmail
    if (secureRandom() > 0.8) wishWishmail = !wishWishmail;
    
    // random override for contacts (remove one or add one)
    if (secureRandom() > 0.7 && wishContacts.length > 0) {
      wishContacts.pop();
    } else if (secureRandom() > 0.7) {
      wishContacts.push({ type: 'FetLife', value: `wish_specific_${Math.floor(secureRandom()*1000)}` });
    }

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
      JSON.stringify(wishContacts),
      wishWishmail ? 1 : 0,
      date,                      
      date,                      
      0                          
    );
  }

  return { usersCreated: 50, wishesCreated: 100 };
}
