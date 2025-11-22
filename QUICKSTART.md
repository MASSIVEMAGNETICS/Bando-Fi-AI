# Next-Gen Image Model - Quick Start Guide

## Overview

The Next-Gen Image Model is a revolutionary image generation system that combines advanced architecture with practical features for production use. This guide will help you get started quickly.

## Installation

No additional installation required! The Next-Gen Model is already integrated into the Bando-Fi AI application.

## Quick Start

### 1. Using the UI Component

Add the Next-Gen Model UI to your application:

```typescript
import { NextGenModelUI } from './src/components/NextGenModelUI';

function App() {
    return (
        <div>
            <NextGenModelUI 
                onImageGenerated={(imageData, metadata) => {
                    console.log('Generated image:', metadata);
                }}
            />
        </div>
    );
}
```

### 2. Using the Model Programmatically

```typescript
import { createDefaultModel } from './src/models/NextGenImageModel';

async function generateImage() {
    // Initialize model
    const model = createDefaultModel();
    await model.initialize();
    
    // Generate image
    const result = await model.generate({
        prompt: 'A beautiful sunset over mountains',
        resolution: 'standard',
        progressCallback: (progress, stage) => {
            console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
        }
    });
    
    console.log('Generated in:', result.metadata.generationTime, 'ms');
    console.log('Quality score:', result.metadata.quality);
    console.log('Layers used:', result.metadata.layersUsed);
}
```

## Key Features

### 1. Progressive Refinement

Generate fast previews, then progressively refine to high quality:

```typescript
// Fast preview (<1 second)
const preview = await model.generate({
    prompt: 'A futuristic city',
    resolution: 'preview'
});

// High-quality final image
const final = await model.generate({
    prompt: 'A futuristic city',
    resolution: 'ultra'
});
```

### 2. Adaptive Architecture

The model automatically adjusts its architecture based on task complexity:

```typescript
// Simple task - uses minimal layers
const simple = await model.generate({
    prompt: 'A red circle',
    resolution: 'standard'
});

// Complex task - uses maximum layers
const complex = await model.generate({
    prompt: 'A photorealistic portrait of a cyberpunk warrior in a neon-lit city with intricate details',
    resolution: 'ultra'
});
```

### 3. Plugin System

Extend functionality with custom plugins:

```typescript
import { ModularPluginSystem } from './src/utils/ModularPluginSystem';

const plugins = new ModularPluginSystem();

// Create custom plugin
plugins.createPlugin(
    'vintage-filter',
    'Vintage Photo Filter',
    'postprocessor',
    (imageData, config) => {
        // Apply vintage effect
        return applyVintageEffect(imageData, config.intensity);
    },
    { config: { intensity: 0.7 } }
);

// Activate and use
plugins.activatePlugin('vintage-filter');
const processed = await plugins.executePlugin('vintage-filter', imageData);
```

### 4. Health Monitoring

Track model health and performance:

```typescript
import { ModelHealthMonitor } from './src/optimization/ModelHealthMonitor';

const monitor = new ModelHealthMonitor();

// Set up alerts
monitor.onAlert((message, severity) => {
    console.log(`[${severity}] ${message}`);
});

// Monitor outputs
const metrics = monitor.monitorOutput(generatedImage);

// Get health report
const report = monitor.getHealthReport();
console.log('Health trend:', report.trend);
console.log('Stability:', report.current.outputStability);
console.log('Hallucination rate:', report.current.hallucinationRate);
```

### 5. Self-Optimization

Enable autonomous performance optimization:

```typescript
const model = createDefaultModel();
await model.initialize();

// Run optimization cycle
await model.optimize();

// Check optimization status
const status = model.getStatus();
console.log('Optimization trend:', status.optimization.trend);
console.log('Improvements:', status.optimization.state.improvements);
```

## Configuration Options

### Model Configuration

Customize the model to your needs:

```typescript
import { NextGenImageModel } from './src/models/NextGenImageModel';

const config = {
    // Fractal attention settings
    fractalAttention: {
        depth: 3,           // Recursion depth (2-5 recommended)
        headCount: 8,       // Number of attention heads (4-16)
        scalingFactor: 2,   // Subdivision factor (2-4)
        sparsityThreshold: 0.01  // Sparsity cutoff (0.001-0.1)
    },
    
    // Adaptive layer settings
    adaptiveLayers: {
        minLayers: 4,       // Minimum layers (2-6)
        maxLayers: 12,      // Maximum layers (8-20)
        expansionThreshold: 0.7,    // When to add layers (0.5-0.9)
        contractionThreshold: 0.3   // When to remove layers (0.1-0.5)
    },
    
    // Resource profile
    resourceProfile: {
        availableMemory: 2048,      // MB (1024-8192)
        computeCapability: 'gpu',   // 'gpu', 'cpu', or 'edge'
        maxBatchSize: 4,            // 1-8
        targetLatency: 1000         // ms (100-5000)
    },
    
    // Inference settings
    inferenceConfig: {
        useMixedPrecision: true,    // Enable mixed precision
        enableQuantization: false,   // Enable quantization
        dynamicBatching: true,      // Enable dynamic batching
        memoryPoolSize: 512         // MB (256-2048)
    },
    
    // Refinement settings
    refinementConfig: {
        scales: [0.25, 0.5, 0.75, 1.0],  // Refinement scales
        refinementSteps: 4,               // Number of steps (2-8)
        qualityThreshold: 0.85            // Quality target (0.7-0.95)
    },
    
    // Feature flags
    enableSelfOptimization: true,
    enableCurriculumLearning: true
};

const model = new NextGenImageModel(config);
```

### Resolution Presets

Choose the right resolution for your use case:

- **preview**: Ultra-fast generation (<1s), low quality
- **standard**: Balanced quality and speed (~3-5s)
- **high**: High quality with moderate speed (~10-15s)
- **ultra**: Maximum quality, slower generation (~20-30s)

## Performance Tips

### 1. Memory Management

For low-memory environments:

```typescript
const config = {
    resourceProfile: {
        availableMemory: 1024,  // 1GB
        computeCapability: 'edge'
    },
    inferenceConfig: {
        useMixedPrecision: true,
        enableQuantization: true
    },
    adaptiveLayers: {
        maxLayers: 8  // Limit complexity
    }
};
```

### 2. Speed Optimization

For fastest generation:

```typescript
const config = {
    resourceProfile: {
        targetLatency: 500  // 0.5s target
    },
    refinementConfig: {
        scales: [0.5, 1.0],  // Fewer refinement steps
        refinementSteps: 2
    }
};
```

### 3. Quality Optimization

For best quality:

```typescript
const config = {
    fractalAttention: {
        depth: 4,
        headCount: 16
    },
    refinementConfig: {
        scales: [0.125, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0],
        refinementSteps: 7,
        qualityThreshold: 0.95
    }
};
```

## Benchmarking

Compare against SOTA models:

```typescript
import { SOTAComparisonFramework } from './src/utils/SOTAComparisonFramework';

const benchmark = new SOTAComparisonFramework();

const testPrompts = [
    'A photorealistic portrait',
    'A fantasy landscape',
    'An abstract artwork'
];

const comparison = await benchmark.runComparison(
    testPrompts,
    async (prompt) => {
        return await model.generate({ prompt, resolution: 'standard' });
    }
);

// Generate report
const report = benchmark.generateReport(comparison);
console.log(report);
```

## Troubleshooting

### Memory Errors

If you encounter out-of-memory errors:

1. Reduce `availableMemory` in config
2. Enable `enableQuantization`
3. Reduce `maxLayers`
4. Use 'preview' or 'standard' resolution

### Slow Generation

If generation is too slow:

1. Reduce `refinementSteps`
2. Reduce number of `scales`
3. Lower `qualityThreshold`
4. Set `computeCapability` to 'gpu' if available

### Quality Issues

If output quality is poor:

1. Increase `depth` and `headCount` in fractal attention
2. Add more refinement `scales`
3. Increase `qualityThreshold`
4. Check model health with `ModelHealthMonitor`

## Best Practices

1. **Always initialize**: Call `model.initialize()` before generation
2. **Monitor health**: Use `ModelHealthMonitor` for production deployments
3. **Optimize regularly**: Run `model.optimize()` periodically
4. **Use plugins wisely**: Activate only necessary plugins for performance
5. **Profile your use case**: Test different configurations to find optimal settings

## Advanced Topics

### Custom Curriculum Learning

```typescript
import { CurriculumLearningScheduler } from './src/training/CurriculumLearningScheduler';

const scheduler = new CurriculumLearningScheduler();
const currentStage = scheduler.getCurrentStage();
const tasks = scheduler.sampleTasksForCurrentStage(10);
```

### Health Alerts

```typescript
const monitor = new ModelHealthMonitor({
    minStability: 0.8,
    maxHallucinationRate: 0.05,
    maxDriftScore: 0.2
});

monitor.onAlert((message, severity) => {
    if (severity === 'high') {
        // Take corrective action
        console.error(message);
        notifyAdministrator(message);
    }
});
```

### Plugin Pipelines

```typescript
const plugins = new ModularPluginSystem();

// Activate multiple plugins
plugins.activatePlugin('noise-reduction');
plugins.activatePlugin('style-guidance');
plugins.activatePlugin('sharpen');

// Execute entire pipeline
const result = await plugins.executePluginsByType(
    'postprocessor',
    imageData
);
```

## Support

For issues or questions:
- Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation
- Review example code in this guide
- Examine the source code for advanced usage

## License

Part of the Bando-Fi AI project by Massive Magnetics.
