/**
 * Example Integration
 * 
 * Demonstrates how to integrate the Next-Gen Model into the existing Bando-Fi AI application
 */

import React, { useState } from 'react';
import { NextGenModelUI } from '../src/components/NextGenModelUI';
import { NextGenImageModel, createDefaultModel } from '../src/models/NextGenImageModel';
import { SOTAComparisonFramework } from '../src/utils/SOTAComparisonFramework';

/**
 * Example 1: Basic Integration
 * 
 * Add the Next-Gen Model UI to your existing application
 */
export const Example1_BasicIntegration = () => {
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleImageGenerated = (imageData: ImageData, metadata: any) => {
        // Convert ImageData to data URL for display
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.putImageData(imageData, 0, 0);
            setGeneratedImage(canvas.toDataURL());
        }
        
        console.log('Image generated with metadata:', metadata);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Next-Gen Model Demo</h1>
            
            <NextGenModelUI onImageGenerated={handleImageGenerated} />
            
            {generatedImage && (
                <div style={{ marginTop: '2rem' }}>
                    <h2>Generated Image</h2>
                    <img 
                        src={generatedImage} 
                        alt="Generated" 
                        style={{ maxWidth: '100%', border: '1px solid #ccc' }}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Example 2: Programmatic Generation
 * 
 * Generate images programmatically without the UI
 */
export const Example2_ProgrammaticGeneration = () => {
    const [model, setModel] = useState<NextGenImageModel | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const initializeModel = async () => {
        setLoading(true);
        const newModel = createDefaultModel();
        await newModel.initialize();
        setModel(newModel);
        setLoading(false);
    };

    const generateImage = async (prompt: string) => {
        if (!model) return;

        setLoading(true);
        const result = await model.generate({
            prompt,
            resolution: 'standard',
            progressCallback: (progress, stage) => {
                console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
            }
        });
        setResult(result);
        setLoading(false);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Programmatic Generation Example</h1>
            
            {!model && (
                <button onClick={initializeModel} disabled={loading}>
                    {loading ? 'Initializing...' : 'Initialize Model'}
                </button>
            )}
            
            {model && (
                <div>
                    <input 
                        type="text" 
                        placeholder="Enter prompt..."
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                generateImage((e.target as HTMLInputElement).value);
                            }
                        }}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                    />
                    
                    {loading && <p>Generating...</p>}
                    
                    {result && (
                        <div>
                            <h2>Result</h2>
                            <p>Generation time: {result.metadata.generationTime.toFixed(0)}ms</p>
                            <p>Quality: {(result.metadata.quality * 100).toFixed(0)}%</p>
                            <p>Layers used: {result.metadata.layersUsed}</p>
                            <p>Memory: {result.metadata.memoryUsed}MB</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Example 3: Benchmarking
 * 
 * Compare model performance against SOTA
 */
export const Example3_Benchmarking = () => {
    const [benchmark] = useState(() => new SOTAComparisonFramework());
    const [running, setRunning] = useState(false);
    const [report, setReport] = useState<string>('');

    const runBenchmark = async () => {
        setRunning(true);
        
        const model = createDefaultModel();
        await model.initialize();
        
        const testPrompts = [
            'A photorealistic portrait of a person',
            'A fantasy landscape with mountains and rivers',
            'An abstract geometric artwork',
            'A futuristic cityscape at night',
            'A vintage photograph of a street scene'
        ];

        const comparison = await benchmark.runComparison(
            testPrompts,
            async (prompt) => {
                return await model.generate({ 
                    prompt, 
                    resolution: 'standard' 
                });
            }
        );

        const reportText = benchmark.generateReport(comparison);
        setReport(reportText);
        setRunning(false);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h1>SOTA Benchmarking Example</h1>
            
            <button onClick={runBenchmark} disabled={running}>
                {running ? 'Running Benchmark...' : 'Run Benchmark'}
            </button>
            
            {report && (
                <div style={{ marginTop: '2rem' }}>
                    <h2>Benchmark Report</h2>
                    <pre style={{ 
                        background: '#f5f5f5', 
                        padding: '1rem', 
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {report}
                    </pre>
                </div>
            )}
        </div>
    );
};

// Export all examples
export const Examples = {
    BasicIntegration: Example1_BasicIntegration,
    ProgrammaticGeneration: Example2_ProgrammaticGeneration,
    Benchmarking: Example3_Benchmarking
};
