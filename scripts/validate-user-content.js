#!/usr/bin/env node
/**
 * Validate user content files against JSON schemas
 * 
 * Usage: npm run validate:user-content
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Simple JSON Schema validator (without external dependencies)
// For production use, consider ajv or similar library

class SchemaValidator {
  constructor() {
    this.errors = [];
  }

  validateType(value, expectedType, fieldPath) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== expectedType) {
      this.errors.push(`${fieldPath}: expected ${expectedType}, got ${actualType}`);
      return false;
    }
    return true;
  }

  validateObject(obj, schema, fieldPath = 'root') {
    if (!obj || typeof obj !== 'object') {
      this.errors.push(`${fieldPath}: expected object`);
      return false;
    }

    // Check required fields
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in obj)) {
          this.errors.push(`${fieldPath}: missing required field "${req}"`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          this.validateProperty(obj[key], propSchema, `${fieldPath}.${key}`);
        }
      }
    }

    // Check additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          this.errors.push(`${fieldPath}: unexpected property "${key}"`);
        }
      }
    }

    return this.errors.length === 0;
  }

  validateProperty(value, schema, fieldPath) {
    // Handle $ref (simplified - only handles internal refs)
    if (schema.$ref) {
      // Skip ref validation in this simple implementation
      return;
    }

    // Handle oneOf
    if (schema.oneOf) {
      let valid = false;
      for (const option of schema.oneOf) {
        const tempValidator = new SchemaValidator();
        tempValidator.validateProperty(value, option, fieldPath);
        if (tempValidator.errors.length === 0) {
          valid = true;
          break;
        }
      }
      if (!valid) {
        this.errors.push(`${fieldPath}: does not match any oneOf options`);
      }
      return;
    }

    // Type check
    if (schema.type) {
      if (!this.validateType(value, schema.type, fieldPath)) {
        return;
      }
    }

    // Enum check
    if (schema.enum) {
      if (!schema.enum.includes(value)) {
        this.errors.push(`${fieldPath}: value "${value}" not in enum [${schema.enum.join(', ')}]`);
      }
    }

    // Minimum check
    if (typeof value === 'number' && schema.minimum !== undefined) {
      if (value < schema.minimum) {
        this.errors.push(`${fieldPath}: value ${value} is less than minimum ${schema.minimum}`);
      }
    }

    // Maximum check
    if (typeof value === 'number' && schema.maximum !== undefined) {
      if (value > schema.maximum) {
        this.errors.push(`${fieldPath}: value ${value} is greater than maximum ${schema.maximum}`);
      }
    }

    // Minimum length for strings
    if (typeof value === 'string' && schema.minLength !== undefined) {
      if (value.length < schema.minLength) {
        this.errors.push(`${fieldPath}: string length ${value.length} is less than minLength ${schema.minLength}`);
      }
    }

    // Maximum length for strings
    if (typeof value === 'string' && schema.maxLength !== undefined) {
      if (value.length > schema.maxLength) {
        this.errors.push(`${fieldPath}: string length ${value.length} is greater than maxLength ${schema.maxLength}`);
      }
    }

    // Pattern check
    if (typeof value === 'string' && schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        this.errors.push(`${fieldPath}: value "${value}" does not match pattern "${schema.pattern}"`);
      }
    }

    // Array validation
    if (Array.isArray(value) && schema.items) {
      value.forEach((item, index) => {
        this.validateProperty(item, schema.items, `${fieldPath}[${index}]`);
      });
    }

    // Object validation
    if (typeof value === 'object' && !Array.isArray(value) && schema.properties) {
      this.validateObject(value, schema, fieldPath);
    }
  }

  getErrors() {
    return this.errors;
  }

  reset() {
    this.errors = [];
  }
}

async function loadSchema(schemaPath) {
  const schemaFile = path.join(rootDir, 'src/schemas', schemaPath);
  const content = await fs.readFile(schemaFile, 'utf-8');
  return JSON.parse(content);
}

async function validateDirectory(dirPath, schema, validator) {
  const files = await fs.readdir(dirPath);
  const results = { valid: 0, invalid: 0, files: [] };

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(dirPath, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      validator.reset();
      validator.validateObject(data, schema);
      
      const errors = validator.getErrors();
      if (errors.length === 0) {
        results.valid++;
        results.files.push({ file, status: 'valid' });
      } else {
        results.invalid++;
        results.files.push({ file, status: 'invalid', errors });
      }
    } catch (err) {
      results.invalid++;
      results.files.push({ file, status: 'error', error: err.message });
    }
  }

  return results;
}

async function main() {
  console.log('🔍 Validating user content against JSON schemas...\n');
  
  const validator = new SchemaValidator();
  const allResults = {};

  // Validate assemblies
  console.log('📦 Validating assemblies...');
  try {
    const assemblySchema = await loadSchema('assembly.schema.json');
    const assemblyDir = path.join(rootDir, 'data/assemblies');
    const results = await validateDirectory(assemblyDir, assemblySchema, validator);
    allResults.assemblies = results;
    console.log(`   ✓ ${results.valid} valid, ${results.invalid} invalid\n`);
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}\n`);
  }

  // Validate characters
  console.log('👤 Validating characters...');
  try {
    const characterSchema = await loadSchema('character.schema.json');
    const characterDir = path.join(rootDir, 'data/characters');
    const results = await validateDirectory(characterDir, characterSchema, validator);
    allResults.characters = results;
    console.log(`   ✓ ${results.valid} valid, ${results.invalid} invalid\n`);
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}\n`);
  }

  // Validate profiles
  console.log('📋 Validating profiles...');
  try {
    const profileSchema = await loadSchema('profile.schema.json');
    const profileDir = path.join(rootDir, 'data/profiles');
    const results = await validateDirectory(profileDir, profileSchema, validator);
    allResults.profiles = results;
    console.log(`   ✓ ${results.valid} valid, ${results.invalid} invalid\n`);
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}\n`);
  }

  // Summary
  console.log('─'.repeat(50));
  console.log('📊 Summary:');
  let totalValid = 0;
  let totalInvalid = 0;
  
  for (const [type, results] of Object.entries(allResults)) {
    console.log(`   ${type}: ${results.valid} valid, ${results.invalid} invalid`);
    totalValid += results.valid;
    totalInvalid += results.invalid;
    
    // Print errors
    for (const file of results.files) {
      if (file.errors) {
        console.log(`\n   ❌ ${file}:`);
        for (const error of file.errors) {
          console.log(`      - ${error}`);
        }
      }
    }
  }
  
  console.log(`\n   Total: ${totalValid} valid, ${totalInvalid} invalid`);
  console.log('─'.repeat(50));

  if (totalInvalid > 0) {
    console.log('\n❌ Validation failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All files valid!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
