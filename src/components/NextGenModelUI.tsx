/**
 * Next-Gen Model UI Component
 * 
 * React component for interacting with the advanced image generation model
 */

import React, { useState, useEffect } from 'react';
import { NextGenImageModel, createDefaultModel, GenerationOptions } from '../models/NextGenImageModel';
import { ModelHealthMonitor } from '../optimization/ModelHealthMonitor';
import { ModularPluginSystem } from '../utils/ModularPluginSystem';

interface NextGenModelUIProps {
    onImageGenerated?: (imageData: ImageData, metadata: any) => void;
    styles?: any;
}

export const NextGenModelUI: React.FC<NextGenModelUIProps> = ({ onImageGenerated, styles = {} }) => {
    const [model, setModel] = useState<NextGenImageModel | null>(null);
    const [healthMonitor] = useState(() => new ModelHealthMonitor());
    const [pluginSystem] = useState(() => new ModularPluginSystem());
    
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStage, setProgressStage] = useState('');
    
    const [prompt, setPrompt] = useState('');
    const [resolution, setResolution] = useState<'preview' | 'standard' | 'high' | 'ultra'>('standard');
    const [enableOptimization, setEnableOptimization] = useState(true);
    
    const [modelStatus, setModelStatus] = useState<any>(null);
    const [healthReport, setHealthReport] = useState<any>(null);
    const [activePlugins, setActivePlugins] = useState<string[]>([]);

    // Initialize model on mount
    useEffect(() => {
        initializeModel();
    }, []);

    const initializeModel = async () => {
        setLoading(true);
        try {
            const newModel = createDefaultModel();
            await newModel.initialize();
            setModel(newModel);
            setInitialized(true);
            
            // Activate some default plugins
            pluginSystem.activatePlugin('style-guidance');
            pluginSystem.activatePlugin('sharpen');
            updateActivePlugins();
            
            // Setup health monitoring
            healthMonitor.onAlert((message, severity) => {
                console.log(`[${severity.toUpperCase()}] ${message}`);
            });
        } catch (error) {
            console.error('Failed to initialize model:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!model || !prompt) return;

        setLoading(true);
        setProgress(0);
        setProgressStage('Starting...');

        try {
            const options: GenerationOptions = {
                prompt,
                resolution,
                progressCallback: (prog, stage) => {
                    setProgress(prog * 100);
                    setProgressStage(stage);
                }
            };

            const result = await model.generate(options);
            
            // Monitor output health
            healthMonitor.monitorOutput(result.imageData);
            
            // Update health report
            updateHealthReport();
            
            if (onImageGenerated) {
                onImageGenerated(result.imageData, result.metadata);
            }

            console.log('Generation complete:', result.metadata);
        } catch (error) {
            console.error('Generation failed:', error);
        } finally {
            setLoading(false);
            setProgress(0);
            setProgressStage('');
        }
    };

    const handleOptimize = async () => {
        if (!model) return;

        setLoading(true);
        try {
            await model.optimize();
            updateModelStatus();
        } catch (error) {
            console.error('Optimization failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateModelStatus = () => {
        if (!model) return;
        const status = model.getStatus();
        setModelStatus(status);
    };

    const updateHealthReport = () => {
        const report = healthMonitor.getHealthReport();
        setHealthReport(report);
    };

    const updateActivePlugins = () => {
        const active = pluginSystem.listActivePlugins().map(p => p.name);
        setActivePlugins(active);
    };

    const togglePlugin = (pluginId: string) => {
        const plugin = pluginSystem.getPlugin(pluginId);
        if (!plugin) return;

        if (activePlugins.includes(plugin.name)) {
            pluginSystem.deactivatePlugin(pluginId);
        } else {
            pluginSystem.activatePlugin(pluginId);
        }
        updateActivePlugins();
    };

    const baseStyles = {
        container: {
            background: 'rgba(10, 10, 10, 0.9)',
            border: '1px solid var(--border-color)',
            borderRadius: '0px',
            padding: '1.5rem',
            marginTop: '2rem',
            ...styles.container
        },
        header: {
            color: 'var(--primary-color)',
            textShadow: '0 0 5px var(--primary-color)',
            marginBottom: '1rem',
            fontSize: '1.5rem',
            fontFamily: "'Orbitron', sans-serif",
            textTransform: 'uppercase' as const,
            ...styles.header
        },
        section: {
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '0px',
            ...styles.section
        },
        sectionTitle: {
            color: 'var(--secondary-color)',
            marginBottom: '0.75rem',
            fontSize: '1rem',
            fontWeight: 'bold' as const,
            ...styles.sectionTitle
        },
        input: {
            width: '100%',
            padding: '0.5rem',
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)',
            color: 'var(--on-surface-color)',
            borderRadius: '0px',
            fontFamily: "'Roboto', sans-serif",
            ...styles.input
        },
        button: {
            padding: '0.75rem 1.5rem',
            background: 'var(--primary-color)',
            color: '#000',
            border: 'none',
            borderRadius: '0px',
            cursor: 'pointer',
            fontWeight: 'bold' as const,
            textTransform: 'uppercase' as const,
            fontFamily: "'Orbitron', sans-serif",
            marginRight: '0.5rem',
            ...styles.button
        },
        secondaryButton: {
            background: 'transparent',
            color: 'var(--primary-color)',
            border: '1px solid var(--primary-color)',
            ...styles.secondaryButton
        },
        progressBar: {
            width: '100%',
            height: '4px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '2px',
            overflow: 'hidden' as const,
            ...styles.progressBar
        },
        progressFill: {
            height: '100%',
            background: 'var(--primary-color)',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 10px var(--primary-color)',
            ...styles.progressFill
        },
        statusGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            ...styles.statusGrid
        },
        statusCard: {
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.75rem',
            borderRadius: '0px',
            border: '1px solid var(--border-color)',
            ...styles.statusCard
        },
        pluginList: {
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '0.5rem',
            ...styles.pluginList
        },
        pluginTag: {
            padding: '0.25rem 0.75rem',
            background: 'rgba(57, 255, 20, 0.2)',
            border: '1px solid var(--primary-color)',
            borderRadius: '12px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            ...styles.pluginTag
        },
        pluginTagInactive: {
            background: 'rgba(128, 128, 128, 0.2)',
            border: '1px solid #666',
            color: '#666',
            ...styles.pluginTagInactive
        }
    };

    if (!initialized) {
        return (
            <div style={baseStyles.container}>
                <h2 style={baseStyles.header}>Next-Gen Model</h2>
                <p>Initializing advanced image generation system...</p>
            </div>
        );
    }

    return (
        <div style={baseStyles.container}>
            <h2 style={baseStyles.header}>🚀 Next-Gen Image Model</h2>
            
            {/* Generation Controls */}
            <div style={baseStyles.section}>
                <h3 style={baseStyles.sectionTitle}>Generation</h3>
                <textarea
                    style={{ ...baseStyles.input, minHeight: '80px', marginBottom: '1rem' }}
                    placeholder="Enter your prompt..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ marginRight: '1rem' }}>Resolution:</label>
                    {(['preview', 'standard', 'high', 'ultra'] as const).map((res) => (
                        <button
                            key={res}
                            style={{
                                ...baseStyles.button,
                                ...(resolution === res ? {} : baseStyles.secondaryButton),
                                marginRight: '0.5rem',
                                padding: '0.5rem 1rem'
                            }}
                            onClick={() => setResolution(res)}
                        >
                            {res}
                        </button>
                    ))}
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        style={baseStyles.button}
                        onClick={handleGenerate}
                        disabled={loading || !prompt}
                    >
                        {loading ? 'Generating...' : 'Generate'}
                    </button>
                    
                    {enableOptimization && (
                        <button
                            style={{ ...baseStyles.button, ...baseStyles.secondaryButton }}
                            onClick={handleOptimize}
                            disabled={loading}
                        >
                            Optimize Model
                        </button>
                    )}
                    
                    <button
                        style={{ ...baseStyles.button, ...baseStyles.secondaryButton }}
                        onClick={updateModelStatus}
                    >
                        Refresh Status
                    </button>
                </div>
                
                {loading && progress > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            {progressStage} - {progress.toFixed(0)}%
                        </div>
                        <div style={baseStyles.progressBar}>
                            <div style={{ ...baseStyles.progressFill, width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Model Status */}
            {modelStatus && (
                <div style={baseStyles.section}>
                    <h3 style={baseStyles.sectionTitle}>Model Status</h3>
                    <div style={baseStyles.statusGrid}>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Active Layers</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
                                {modelStatus.architecture?.activeLayers || 0}
                            </div>
                        </div>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avg Latency</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
                                {modelStatus.performance?.avgLatency?.toFixed(0) || 0}ms
                            </div>
                        </div>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Target Latency Met</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
                                {modelStatus.performance?.targetLatencyMet?.toFixed(0) || 0}%
                            </div>
                        </div>
                        {modelStatus.optimization && (
                            <div style={baseStyles.statusCard}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Optimization Trend</div>
                                <div style={{ fontSize: '1.2rem', color: 'var(--secondary-color)' }}>
                                    {modelStatus.optimization.trend}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Health Report */}
            {healthReport && (
                <div style={baseStyles.section}>
                    <h3 style={baseStyles.sectionTitle}>Model Health</h3>
                    <div style={baseStyles.statusGrid}>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Output Stability</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
                                {(healthReport.current?.outputStability * 100)?.toFixed(0) || 0}%
                            </div>
                        </div>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Hallucination Rate</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--error-color)' }}>
                                {(healthReport.current?.hallucinationRate * 100)?.toFixed(0) || 0}%
                            </div>
                        </div>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Confidence</div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--secondary-color)' }}>
                                {(healthReport.current?.confidenceLevel * 100)?.toFixed(0) || 0}%
                            </div>
                        </div>
                        <div style={baseStyles.statusCard}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Health Trend</div>
                            <div style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>
                                {healthReport.trend}
                            </div>
                        </div>
                    </div>
                    
                    {healthReport.recommendations?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.8 }}>
                                Recommendations:
                            </div>
                            <ul style={{ paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                                {healthReport.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Plugin System */}
            <div style={baseStyles.section}>
                <h3 style={baseStyles.sectionTitle}>Active Plugins ({activePlugins.length})</h3>
                <div style={baseStyles.pluginList}>
                    {pluginSystem.listPlugins().map((plugin) => (
                        <div
                            key={plugin.id}
                            style={{
                                ...baseStyles.pluginTag,
                                ...(activePlugins.includes(plugin.name) ? {} : baseStyles.pluginTagInactive)
                            }}
                            onClick={() => togglePlugin(plugin.id)}
                            title={plugin.description}
                        >
                            {plugin.name}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
