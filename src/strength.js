//evalua seguridad de contraseñas 
export function passwordStrength(password, validation) {
  if (!validation.valid) {
    return 'baja';
  }

  function hasUpper(text) {
    for (const c of text) {
      if (c >= 'A' && c <= 'Z') return true;
    }
    return false;
  }

  function hasLower(text) {
    for (const c of text) {
      if (c >= 'a' && c <= 'z') return true;
    }
    return false;
  }

  function hasDigit(text) {
    for (const c of text) {
      if (c >= '0' && c <= '9') return true;
    }
    return false;
  }

  function hasSymbol(text) {
    const symbols = new Set('!#$%&*+=?'.split(''));
    for (const c of text) {
      if (symbols.has(c)) return true;
    }
    return false;
  }

  let classes = 0;
  if (hasUpper(password)) classes += 1;
  if (hasLower(password)) classes += 1;
  if (hasDigit(password)) classes += 1;
  if (hasSymbol(password)) classes += 1;

  if (password.length >= 16 && classes >= 4) {
    return 'fuerte';
  }
  if (password.length >= 12 && classes >= 3) {
    return 'media';
  }
  return 'baja';
}
