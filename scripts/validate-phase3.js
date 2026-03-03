#!/usr/bin/env node

/**
 * Phase 3 Validation Script
 * Performs comprehensive validation of Phase 3 UI integration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Phase 3 Validation...');
console.log('===============================\n');

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const WEBUI_DIR = path.join(ROOT_DIR, 'src/control/webui');
const REQUIRED_FILES = [
  'App.tsx',
  'main.ts',
  'layouts/DashboardLayout.ts',
  'pages/DashboardHome.ts',
  'pages/AudioVisualization.ts',
  'pages/DMXMonitor.ts',
  'pages/SceneEditor.ts',
  'pages/EffectEditor.ts',
  'pages/FixtureManager.ts',
  'pages/RuleEditor.ts',
  'store/store.ts',
  'store/store-extended.ts',
  'utils/performance.ts',
  'utils/socket.ts',
  'utils/configLoader.ts',
  'test/integration.test.ts',
  'test/e2e/phase3.spec.ts',
  'docs/PHASE3_UI_GUIDE.md'
];

const REQUIRED_COMPONENTS = [
  'components/visualization/SpectrumVisualizer.ts',
  'components/visualization/WaveformView.ts',
  'components/visualization/MeterComponent.ts',
  'components/visualization/DMXChannelGrid.ts',
  'components/Button.ts',
  'components/Panel.ts'
];

// Validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

/**
 * Check if file exists
 */
function checkFileExists(filePath, description) {
  const fullPath = path.join(WEBUI_DIR, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    results.passed++;
    results.details.push(`✅ ${description}: ${filePath}`);
    
    // Check file size
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      results.warnings++;
      results.details.push(`   ⚠️  Warning: File is empty`);
    }
    
    return true;
  } else {
    results.failed++;
    results.details.push(`❌ ${description}: ${filePath} - NOT FOUND`);
    return false;
  }
}

/**
 * Check TypeScript compilation
 */
function checkTypeScript() {
  console.log('🔍 Checking TypeScript compilation...');
  
  try {
    // Try to compile main.ts
    const tsconfigPath = path.join(WEBUI_DIR, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      execSync('npx tsc --noEmit', { 
        cwd: WEBUI_DIR, 
        stdio: 'pipe' 
      });
      results.passed++;
      results.details.push('✅ TypeScript compilation: No errors');
    } else {
      results.warnings++;
      results.details.push('⚠️  TypeScript: No tsconfig.json found');
    }
  } catch (error) {
    results.failed++;
    results.details.push(`❌ TypeScript compilation: Errors found`);
    results.details.push(`   ${error.message.split('\n')[0]}`);
  }
}

/**
 * Check package.json scripts
 */
function checkPackageScripts() {
  console.log('📦 Checking package.json scripts...');
  
  const packagePath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(packagePath)) {
    results.failed++;
    results.details.push('❌ package.json: Not found');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = packageJson.scripts || {};
  
  const requiredScripts = [
    'phase3:dev',
    'phase3:build',
    'phase3:preview',
    'phase3:test'
  ];
  
  requiredScripts.forEach(script => {
    if (scripts[script]) {
      results.passed++;
      results.details.push(`✅ Script: ${script}`);
    } else {
      results.failed++;
      results.details.push(`❌ Script: ${script} - Missing`);
    }
  });
}

/**
 * Check Vite configuration
 */
function checkViteConfig() {
  console.log('⚡ Checking Vite configuration...');
  
  const viteConfigPath = path.join(ROOT_DIR, 'vite.config.ts');
  if (!fs.existsSync(viteConfigPath)) {
    results.failed++;
    results.details.push('❌ Vite config: Not found');
    return;
  }
  
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Check for optimization features
  const checks = [
    { name: 'Code splitting', regex: /manualChunks/ },
    { name: 'Minification', regex: /minify.*terser/ },
    { name: 'Source maps', regex: /sourcemap/ },
    { name: 'Tree shaking', regex: /treeshake/ }
  ];
  
  checks.forEach(check => {
    if (check.regex.test(content)) {
      results.passed++;
      results.details.push(`✅ Vite: ${check.name} enabled`);
    } else {
      results.warnings++;
      results.details.push(`⚠️  Vite: ${check.name} not configured`);
    }
  });
}

/**
 * Check test coverage
 */
function checkTestCoverage() {
  console.log('🧪 Checking test coverage...');
  
  const testFiles = [
    'test/integration.test.ts',
    'test/e2e/phase3.spec.ts',
    'test/unit/components.test.ts'
  ];
  
  testFiles.forEach(testFile => {
    const fullPath = path.join(WEBUI_DIR, testFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const testCount = (content.match(/test\(/g) || []).length + 
                       (content.match(/it\(/g) || []).length +
                       (content.match(/describe\(/g) || []).length;
      
      results.passed++;
      results.details.push(`✅ Test file: ${testFile} (${testCount} tests)`);
    } else {
      results.warnings++;
      results.details.push(`⚠️  Test file: ${testFile} - Not found`);
    }
  });
}

/**
 * Check documentation
 */
function checkDocumentation() {
  console.log('📚 Checking documentation...');
  
  const docsPath = path.join(WEBUI_DIR, 'docs');
  if (!fs.existsSync(docsPath)) {
    results.failed++;
    results.details.push('❌ Documentation: docs/ directory not found');
    return;
  }
  
  const docsFiles = fs.readdirSync(docsPath);
  const hasGuide = docsFiles.includes('PHASE3_UI_GUIDE.md');
  const hasAPI = docsFiles.some(f => f.includes('API') || f.includes('REFERENCE'));
  
  if (hasGuide) {
    results.passed++;
    results.details.push('✅ Documentation: Phase 3 Guide found');
    
    // Check guide content
    const guidePath = path.join(docsPath, 'PHASE3_UI_GUIDE.md');
    const guideContent = fs.readFileSync(guidePath, 'utf8');
    const guideSize = guideContent.length;
    
    if (guideSize > 10000) {
      results.passed++;
      results.details.push(`✅ Documentation: Comprehensive guide (${guideSize} chars)`);
    } else {
      results.warnings++;
      results.details.push(`⚠️  Documentation: Guide might be too short (${guideSize} chars)`);
    }
  } else {
    results.failed++;
    results.details.push('❌ Documentation: Phase 3 Guide missing');
  }
  
  if (hasAPI) {
    results.passed++;
    results.details.push('✅ Documentation: API reference found');
  } else {
    results.warnings++;
    results.details.push('⚠️  Documentation: API reference missing');
  }
}

/**
 * Check performance optimizations
 */
function checkPerformanceOptimizations() {
  console.log('⚡ Checking performance optimizations...');
  
  // Check for performance analyzer
  const perfAnalyzerPath = path.join(WEBUI_DIR, 'utils/performance-analyzer.ts');
  if (fs.existsSync(perfAnalyzerPath)) {
    results.passed++;
    results.details.push('✅ Performance: Analyzer implemented');
  } else {
    results.warnings++;
    results.details.push('⚠️  Performance: Analyzer not found');
  }
  
  // Check for lazy loading patterns
  const appPath = path.join(WEBUI_DIR, 'App.tsx');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    const checks = [
      { name: 'Lazy loading', regex: /lazy.*loading|dynamic.*import/i },
      { name: 'Memoization', regex: /memo|useMemo|useCallback/ },
      { name: 'Debouncing', regex: /debounce/ },
      { name: 'Throttling', regex: /throttle/ }
    ];
    
    checks.forEach(check => {
      if (check.regex.test(appContent)) {
        results.passed++;
        results.details.push(`✅ Performance: ${check.name} used`);
      } else {
        results.warnings++;
        results.details.push(`⚠️  Performance: ${check.name} not detected`);
      }
    });
  }
}

/**
 * Run all validations
 */
function runValidations() {
  console.log('📁 Checking required files...\n');
  
  // Check required files
  REQUIRED_FILES.forEach(file => {
    checkFileExists(file, 'Required file');
  });
  
  // Check required components
  REQUIRED_COMPONENTS.forEach(component => {
    checkFileExists(component, 'Component');
  });
  
  console.log('\n🔧 Checking configurations...\n');
  
  // Run other validations
  checkTypeScript();
  checkPackageScripts();
  checkViteConfig();
  checkTestCoverage();
  checkDocumentation();
  checkPerformanceOptimizations();
  
  console.log('\n📊 Validation Results:');
  console.log('====================\n');
  
  // Print details
  results.details.forEach(detail => {
    console.log(detail);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log('='.repeat(50));
  
  // Calculate score
  const total = results.passed + results.failed + results.warnings;
  const score = Math.round((results.passed / total) * 100);
  
  console.log(`\n🎯 Validation Score: ${score}%`);
  
  if (score >= 90) {
    console.log('🏆 EXCELLENT: Phase 3 UI is well integrated and validated!');
  } else if (score >= 70) {
    console.log('👍 GOOD: Phase 3 UI is integrated but needs some improvements.');
  } else if (score >= 50) {
    console.log('⚠️  FAIR: Phase 3 UI integration needs significant work.');
  } else {
    console.log('🚨 POOR: Phase 3 UI integration is incomplete.');
  }
  
  // Return exit code
  if (results.failed > 0) {
    console.log('\n❌ Validation failed with critical errors.');
    process.exit(1);
  } else if (results.warnings > 5) {
    console.log('\n⚠️  Validation passed with warnings.');
    process.exit(0);
  } else {
    console.log('\n✅ Validation passed successfully!');
    process.exit(0);
  }
}

// Run validations
try {
  runValidations();
} catch (error) {
  console.error('💥 Validation script error:', error.message);
  process.exit(1);
}