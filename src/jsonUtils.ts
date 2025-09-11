export function flattenJson(obj: any, prefix = ''): Record<string, string> {
  let result: Record<string, string> = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      result[newKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string') {
            result[`${newKey}[${index}]`] = item;
          } else if (typeof item === 'object' && item !== null) {
            Object.assign(result, flattenJson(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = String(item);
          }
        });
      } else {
        Object.assign(result, flattenJson(value, newKey));
      }
    } else {
      result[newKey] = String(value);
    }
  }
  return result;
}

export function unflattenJson(flat: Record<string, string>): any {
  const result: any = {};
  
  for (const key in flat) {
    const parts = key.split('.');
    let current = result;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      
      if (arrayMatch) {
        const arrayKey = arrayMatch[1];
        const arrayIndex = parseInt(arrayMatch[2]);
        
        if (i === parts.length - 1) {
          if (!current[arrayKey]) {
            current[arrayKey] = [];
          }
          while (current[arrayKey].length <= arrayIndex) {
            current[arrayKey].push('');
          }
          current[arrayKey][arrayIndex] = flat[key];
        } else {
          if (!current[arrayKey]) {
            current[arrayKey] = [];
          }
          while (current[arrayKey].length <= arrayIndex) {
            current[arrayKey].push({});
          }
          current = current[arrayKey][arrayIndex];
        }
      } else {
        if (i === parts.length - 1) {
          current[part] = flat[key];
        } else {
          if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
  }
  
  return result;
}