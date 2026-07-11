const posPattern = /\b(n|v|adj|adv|prep|conj|pron|num|art|int|vi|vt|pl|abbr|phr|aux|modal)\b\.?/gi;

export function normalizeMeaning(value: string) {
  return value
    .toLowerCase()
    .replace(posPattern, ' ')
    .replace(/[（）()[\]{}【】《》<>]/g, ' ')
    .replace(/[.,!?;:，。！？；：、/\\|·~～…"'“”‘’`^+=*_#@$%&-]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

export function splitMeaningFragments(value: string) {
  return value
    .replace(posPattern, ' ')
    .split(/[;；,，、/\\|]|或|和|及|与|以及/)
    .map(normalizeMeaning)
    .filter(fragment => fragment.length >= 2);
}

export function isMeaningMatch(input: string, targets: string[]) {
  const user = normalizeMeaning(input);
  if (user.length < 2) {
    return false;
  }

  return targets.some((target) => {
    const compactTarget = normalizeMeaning(target);
    if (!compactTarget) return false;
    if (user === compactTarget) return true;
    if (user.length >= 2 && compactTarget.includes(user)) return true;

    return splitMeaningFragments(target).some((fragment) =>
      user === fragment || user.includes(fragment) || fragment.includes(user)
    );
  });
}

export function extractMeaningText(optionText: string) {
  return optionText.replace(posPattern, ' ').trim();
}
