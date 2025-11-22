/**
 * Memory-Aware Inference Engine
 * 
 * Optimizes inference based on available memory and computational resources,
 * supporting GPU, CPU, and edge deployment scenarios.
 */

export interface ResourceProfile {
    availableMemory: number; // in MB
    computeCapability: 'gpu' | 'cpu' | 'edge';
    maxBatchSize: number;
    targetLatency: number; // in ms
}

export interface InferenceConfig {
    useMixedPrecision: boolean;
    enableQuantization: boolean;
    dynamicBatching: boolean;
    memoryPoolSize: number;
}

export class MemoryAwareInferenceEngine {
    private profile: ResourceProfile;
    private config: InferenceConfig;
    private memoryUsage: number;
    private inferenceHistory: { latency: number; memoryUsed: number }[];
    
    constructor(profile: ResourceProfile, config: InferenceConfig) {
        this.profile = profile;
        this.config = config;
        this.memoryUsage = 0;
        this.inferenceHistory = [];
    }

    /**
     * Execute inference with memory-aware optimizations
     */
    public async executeInference(
        input: Float32Array,
        modelFn: (input: Float32Array) => Promise<Float32Array>
    ): Promise<Float32Array> {
        const startTime = performance.now();
        
        // Check memory availability
        if (!this.checkMemoryAvailability(input.length * 4)) {
            return this.executeWithMemoryConstraints(input, modelFn);
        }

        // Select precision based on profile
        const processedInput = this.config.useMixedPrecision 
            ? this.convertToMixedPrecision(input)
            : input;

        // Execute inference
        const result = await modelFn(processedInput);
        
        // Track performance
        const latency = performance.now() - startTime;
        this.trackInference(latency, this.memoryUsage);
        
        return result;
    }

    /**
     * Execute inference with memory constraints using progressive loading
     */
    private async executeWithMemoryConstraints(
        input: Float32Array,
        modelFn: (input: Float32Array) => Promise<Float32Array>
    ): Promise<Float32Array> {
        console.log('Memory constrained mode: Using progressive inference');
        
        // Split input into chunks
        const chunkSize = this.calculateOptimalChunkSize();
        const chunks = this.splitIntoChunks(input, chunkSize);
        
        const results: Float32Array[] = [];
        for (const chunk of chunks) {
            const result = await modelFn(chunk);
            results.push(result);
            // Allow garbage collection between chunks
            await this.yield();
        }
        
        return this.mergeResults(results);
    }

    private checkMemoryAvailability(requiredMemory: number): boolean {
        const availableMemory = this.profile.availableMemory * 1024 * 1024; // Convert to bytes
        return (this.memoryUsage + requiredMemory) < availableMemory * 0.8; // Keep 20% buffer
    }

    private calculateOptimalChunkSize(): number {
        const availableMemory = this.profile.availableMemory * 1024 * 1024;
        const safeMemory = availableMemory * 0.5; // Use 50% for safety
        return Math.floor(safeMemory / 4); // 4 bytes per float32
    }

    private convertToMixedPrecision(input: Float32Array): Float32Array {
        // Simulate mixed precision by reducing precision of smaller values
        return input.map(val => {
            if (Math.abs(val) < 0.01) {
                return Math.round(val * 100) / 100; // Reduce precision for small values
            }
            return val;
        });
    }

    private splitIntoChunks(data: Float32Array, chunkSize: number): Float32Array[] {
        const chunks: Float32Array[] = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, Math.min(i + chunkSize, data.length)));
        }
        return chunks;
    }

    private mergeResults(results: Float32Array[]): Float32Array {
        const totalLength = results.reduce((sum, r) => sum + r.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const result of results) {
            merged.set(result, offset);
            offset += result.length;
        }
        return merged;
    }

    private async yield(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private trackInference(latency: number, memoryUsed: number): void {
        this.inferenceHistory.push({ latency, memoryUsed });
        if (this.inferenceHistory.length > 100) {
            this.inferenceHistory.shift();
        }
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): {
        avgLatency: number;
        avgMemoryUsage: number;
        targetLatencyMet: number;
    } {
        if (this.inferenceHistory.length === 0) {
            return { avgLatency: 0, avgMemoryUsage: 0, targetLatencyMet: 0 };
        }

        const avgLatency = this.inferenceHistory.reduce((sum, h) => sum + h.latency, 0) / this.inferenceHistory.length;
        const avgMemoryUsage = this.inferenceHistory.reduce((sum, h) => sum + h.memoryUsed, 0) / this.inferenceHistory.length;
        const targetMet = this.inferenceHistory.filter(h => h.latency <= this.profile.targetLatency).length;
        
        return {
            avgLatency,
            avgMemoryUsage,
            targetLatencyMet: (targetMet / this.inferenceHistory.length) * 100
        };
    }

    /**
     * Optimize inference settings based on historical performance
     */
    public optimizeSettings(): void {
        const metrics = this.getPerformanceMetrics();
        
        if (metrics.targetLatencyMet < 80 && !this.config.useMixedPrecision) {
            console.log('Enabling mixed precision to improve latency');
            this.config.useMixedPrecision = true;
        }
        
        if (metrics.avgMemoryUsage > this.profile.availableMemory * 0.7) {
            console.log('High memory usage detected, enabling aggressive optimization');
            this.config.enableQuantization = true;
        }
    }
}
