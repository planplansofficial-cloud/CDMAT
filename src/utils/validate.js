/**
 * Input Validation Module
 * 
 * OWASP-aligned validation: type checks, length limits, pattern matching,
 * and sanitization for all user inputs. Rejects unexpected fields.
 * 
 * Every validation returns { valid: boolean, error?: string }
 */

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/** Strip tags, zero-width chars, and control chars (except \n \t) */
export function sanitizeText(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")           // HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")       // zero-width
    .trim();
}

/** Keep only whitelisted fields, reject unexpected ones */
export function pickAllowed(obj, allowedKeys) {
  const clean = {};
  for (const key of allowedKeys) {
    if (key in obj) clean[key] = obj[key];
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Individual Validators
// ---------------------------------------------------------------------------

function required(value, label) {
  if (value === undefined || value === null || value === "") {
    return { valid: false, error: `${label} is required` };
  }
  return { valid: true };
}

function stringType(value, label) {
  if (typeof value !== "string") {
    return { valid: false, error: `${label} must be a string` };
  }
  return { valid: true };
}

function maxLength(value, max, label) {
  if (typeof value === "string" && value.length > max) {
    return { valid: false, error: `${label} must be ${max} characters or fewer` };
  }
  return { valid: true };
}

function minLength(value, min, label) {
  if (typeof value === "string" && value.length < min) {
    return { valid: false, error: `${label} must be at least ${min} characters` };
  }
  return { valid: true };
}

function patternMatch(value, regex, label, hint) {
  if (typeof value === "string" && !regex.test(value)) {
    return { valid: false, error: `${label}: ${hint}` };
  }
  return { valid: true };
}

function noScripts(value, label) {
  if (typeof value === "string" && /<script|javascript:|on\w+=/i.test(value)) {
    return { valid: false, error: `${label} contains disallowed content` };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

function validateField(value, label, rules) {
  for (const rule of rules) {
    const result = rule(value, label);
    if (!result.valid) return result;
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Schemas — one function per form / action
// ---------------------------------------------------------------------------

/**
 * Validate login credentials
 */
export function validateLogin(id, password) {
  const idResult = validateField(id, "ID", [
    (v, l) => required(v, l),
    (v, l) => stringType(v, l),
    (v, l) => maxLength(v, 50, l),
    (v, l) => patternMatch(v, /^[a-zA-Z0-9@._-]+$/, l, "only letters, numbers, @ . _ -"),
    (v, l) => noScripts(v, l),
  ]);
  if (!idResult.valid) return idResult;

  const pwResult = validateField(password, "Password", [
    (v, l) => required(v, l),
    (v, l) => stringType(v, l),
    (v, l) => maxLength(v, 100, l),
  ]);
  return pwResult;
}

/**
 * Validate poll creation data
 */
export function validatePollCreate({ title, description, mode, options, visibleOptionCount }) {
  const titleR = validateField(title, "Title", [
    (v, l) => required(v, l),
    (v, l) => stringType(v, l),
    (v, l) => maxLength(v, 200, l),
    (v, l) => minLength(v, 1, l),
    (v, l) => noScripts(v, l),
  ]);
  if (!titleR.valid) return titleR;

  if (description) {
    const descR = validateField(description, "Description", [
      (v, l) => stringType(v, l),
      (v, l) => maxLength(v, 1000, l),
      (v, l) => noScripts(v, l),
    ]);
    if (!descR.valid) return descR;
  }

  if (mode !== "candidate" && mode !== "decision") {
    return { valid: false, error: "Invalid poll mode" };
  }

  if (!Array.isArray(options) || options.length < 2) {
    return { valid: false, error: "At least 2 options are required" };
  }
  if (options.length > 20) {
    return { valid: false, error: "Maximum 20 options allowed" };
  }

  if (mode === "candidate") {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const nameR = validateField(opt.name, `Candidate ${i + 1} name`, [
        (v, l) => required(v, l),
        (v, l) => stringType(v, l),
        (v, l) => maxLength(v, 100, l),
        (v, l) => noScripts(v, l),
      ]);
      if (!nameR.valid) return nameR;

      const rollR = validateField(opt.roll, `Candidate ${i + 1} roll`, [
        (v, l) => required(v, l),
        (v, l) => stringType(v, l),
        (v, l) => maxLength(v, 20, l),
        (v, l) => patternMatch(v, /^[a-zA-Z0-9-]+$/, l, "only letters, numbers, hyphens"),
      ]);
      if (!rollR.valid) return rollR;
    }
  } else {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const textR = validateField(opt.text, `Option ${i + 1}`, [
        (v, l) => required(v, l),
        (v, l) => stringType(v, l),
        (v, l) => maxLength(v, 500, l),
        (v, l) => noScripts(v, l),
      ]);
      if (!textR.valid) return textR;
    }
    if (typeof visibleOptionCount !== "number" || visibleOptionCount < 1) {
      return { valid: false, error: "Visible option count must be at least 1" };
    }
  }

  return { valid: true };
}

/**
 * Validate password change
 */
export function validatePasswordChange(currentPassword, newPassword, confirmPassword) {
  const curR = validateField(currentPassword, "Current password", [
    (v, l) => required(v, l),
    (v, l) => stringType(v, l),
    (v, l) => maxLength(v, 100, l),
  ]);
  if (!curR.valid) return curR;

  const newR = validateField(newPassword, "New password", [
    (v, l) => required(v, l),
    (v, l) => stringType(v, l),
    (v, l) => minLength(v, 8, l),
    (v, l) => maxLength(v, 100, l),
  ]);
  if (!newR.valid) return newR;

  if (newPassword === currentPassword) {
    return { valid: false, error: "New password must be different from current password" };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: "Passwords do not match" };
  }

  return { valid: true };
}

/**
 * Validate vote selection
 */
export function validateVote(selected, pollOptions) {
  if (!selected || typeof selected.id !== "string") {
    return { valid: false, error: "Please select an option" };
  }
  const validIds = new Set(pollOptions.map((o) => o.id));
  if (!validIds.has(selected.id)) {
    return { valid: false, error: "Invalid selection" };
  }
  return { valid: true };
}

/**
 * Validate file upload (photo)
 */
export function validatePhotoUpload(file) {
  if (!file) return { valid: false, error: "No file selected" };
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { valid: false, error: "Only JPG, PNG, and WebP images are allowed" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: "Image must be under 5MB" };
  }
  return { valid: true };
}
