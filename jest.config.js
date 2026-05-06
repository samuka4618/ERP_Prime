/** @type {import('jest').Config} */
// #region agent log
fetch('http://127.0.0.1:7543/ingest/405e7796-cce6-468f-b8e1-2439a4318f0e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d173df'},body:JSON.stringify({sessionId:'d173df',runId:'pre-fix',hypothesisId:'H2',location:'jest.config.js:2',message:'Jest config loaded',data:{cwd:process.cwd(),nodeVersion:process.version,hasNodeModules:require('fs').existsSync(require('path').join(process.cwd(),'node_modules')),hasTsJestPackageJson:require('fs').existsSync(require('path').join(process.cwd(),'node_modules','ts-jest','package.json'))},timestamp:Date.now()})}).catch(()=>{});
// #endregion
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  verbose: true
};
