# Wishboard Matching Engine Rules

The Wishboard matching engine is designed to be inclusive, flexible, and
powerful. It leverages four types of rules to create connections between users
based on their identities (gender, orientation, role) and their desired matches.

## 1. Enrichment (Implicit Attribute Mapping)

**Purpose**: To implicitly add an attribute to a user's profile based on the
presence of another attribute.

If a user identifies with a certain combination of traits, they implicitly
possess another trait in the context of matching.

**Format**:

- `trigger_attribute` & `trigger_value`: The primary trait the user has.
- `context_attribute` & `context_value` (Optional): A secondary trait the user
  must also have.
- `target_attribute` & `target_value`: The new trait implicitly added to the
  user's profile.

**Example**:

A user who is a "woman" (context) and identifies as "gay" (trigger) is
implicitly enriched with the "lesbian" (target) orientation. This ensures they
match with people seeking lesbians.

---

## 2. Acceptance (Blanket Override)

**Purpose**: To allow a specific identity to automatically accept a broad range
of target identities, overriding strict one-to-one matching.

When a user searches for a specific trait, or a wish desires a specific trait,
an acceptance rule forces the matching engine to accept a list of other traits
as compatible.

**Format**:

- `trigger_attribute` & `trigger_value`: The trait the searcher/wisher
  possesses or is looking for.
- `target_attribute` & `target_value`: A comma-separated list of traits that
  are automatically accepted.

**Example**:

If a user's orientation is "pan" (pansexual), an acceptance rule automatically
targets the gender attribute and accepts `"man, woman, nonbinary, cis-man,
cis-woman, trans-man, trans-woman, men, women"`. The matching engine will treat
the user as compatible with any of these genders.

---

## 3. Expansion (Inclusive Expansion)

**Purpose**: To broaden a specific search term or requirement to include
related terms or sub-categories.

This prevents users from having to list every possible synonym or sub-category
when creating a wish or searching.

**Format**:

- `trigger_attribute` & `trigger_value`: The broad term being searched for or
  desired.
- `target_attribute` & `target_value`: A comma-separated list of more specific
  terms that should also trigger a match. (Note: `trigger_attribute` and
  `target_attribute` are always the same).

**Example**:

If a wish desires a "pet", an expansion rule will automatically expand that
requirement to also match with users identifying as a "pup" or "kitten".

---

## 4. Cross-Match (Complementary Roles)

**Purpose**: To create bidirectional, complementary connections between different
roles or identities.

This is crucial for role-based matching where a user identifying as Role A is
inherently seeking Role B, and vice-versa.

**Format**:

- `trigger_attribute` & `trigger_value`: The first role (e.g., "handler").
- `target_attribute` & `target_value`: The complementary role (e.g., "pet").

**Example**:

A cross-match rule between "handler" and "pet" means:

1. If a wish desires a "handler", a user identifying as a "pet" will match.
2. If a wish desires a "pet", a user identifying as a "handler" will match.

Combined with an **Expansion** rule (e.g., "pet" expands to "pup, kitten"), a
"handler" will automatically match with a "pup" or "kitten" without needing
explicit rules for every combination!
