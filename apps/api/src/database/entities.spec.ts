import { getMetadataArgsStorage } from 'typeorm';

import { entities } from './entities';

describe('database entity mapping', () => {
  it('gives every camelCase column an explicit snake_case database name', () => {
    const entityTargets = new Set<unknown>(entities);
    const missingNames = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          typeof column.target === 'function' &&
          entityTargets.has(column.target) &&
          /[A-Z]/.test(column.propertyName) &&
          !column.options.name
      )
      .map(
        (column) =>
          `${typeof column.target === 'function' ? column.target.name : String(column.target)}.${column.propertyName}`
      );

    expect(missingNames).toEqual([]);
  });
});
