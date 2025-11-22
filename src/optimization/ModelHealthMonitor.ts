/**
 * Model Health Monitor
 * 
 * Tracks model health, drift detection, and hallucination minimization.
 */

export interface HealthMetrics {
    outputStability: number;
    hallucinationRate: number;
    driftScore: number;
    confidenceLevel: number;
    anomalyDetected: boolean;
}

export interface HealthThresholds {
    minStability: number;
    maxHallucinationRate: number;
    maxDriftScore: number;
    minConfidence: number;
}

export class ModelHealthMonitor {
    private thresholds: HealthThresholds;
    private outputHistory: any[];
    private baselineMetrics: HealthMetrics | null;
    private alertCallbacks: ((alert: string, severity: 'low' | 'medium' | 'high') => void)[];
    
    constructor(thresholds?: Partial<HealthThresholds>) {
        this.thresholds = {
            minStability: 0.7,
            maxHallucinationRate: 0.1,
            maxDriftScore: 0.3,
            minConfidence: 0.6,
            ...thresholds
        };
        this.outputHistory = [];
        this.baselineMetrics = null;
        this.alertCallbacks = [];
    }

    /**
     * Register alert callback
     */
    public onAlert(callback: (alert: string, severity: 'low' | 'medium' | 'high') => void): void {
        this.alertCallbacks.push(callback);
    }

    /**
     * Monitor model output and update health metrics
     */
    public monitorOutput(output: any, expectedPattern?: any): HealthMetrics {
        this.outputHistory.push({
            output,
            timestamp: Date.now(),
            expectedPattern
        });

        // Keep rolling window
        if (this.outputHistory.length > 100) {
            this.outputHistory.shift();
        }

        const metrics = this.calculateHealthMetrics();

        // Set baseline if not exists
        if (!this.baselineMetrics) {
            this.baselineMetrics = { ...metrics };
        }

        // Check for issues
        this.checkHealthIssues(metrics);

        return metrics;
    }

    private calculateHealthMetrics(): HealthMetrics {
        return {
            outputStability: this.calculateOutputStability(),
            hallucinationRate: this.estimateHallucinationRate(),
            driftScore: this.calculateDrift(),
            confidenceLevel: this.calculateConfidence(),
            anomalyDetected: this.detectAnomalies()
        };
    }

    private calculateOutputStability(): number {
        if (this.outputHistory.length < 2) return 1.0;

        // Measure consistency between consecutive outputs
        let similaritySum = 0;
        for (let i = 1; i < this.outputHistory.length; i++) {
            const similarity = this.computeSimilarity(
                this.outputHistory[i - 1].output,
                this.outputHistory[i].output
            );
            similaritySum += similarity;
        }

        return similaritySum / (this.outputHistory.length - 1);
    }

    private estimateHallucinationRate(): number {
        // Count outputs that deviate significantly from expected patterns
        let hallucinationCount = 0;
        let totalWithExpected = 0;

        for (const entry of this.outputHistory) {
            if (entry.expectedPattern) {
                totalWithExpected++;
                const similarity = this.computeSimilarity(entry.output, entry.expectedPattern);
                if (similarity < 0.3) {
                    hallucinationCount++;
                }
            }
        }

        return totalWithExpected > 0 ? hallucinationCount / totalWithExpected : 0;
    }

    private calculateDrift(): number {
        if (!this.baselineMetrics || this.outputHistory.length < 10) return 0;

        // Compare recent outputs to baseline
        const recentOutputs = this.outputHistory.slice(-10);
        const baselineOutputs = this.outputHistory.slice(0, 10);

        let driftSum = 0;
        const compareCount = Math.min(recentOutputs.length, baselineOutputs.length);

        for (let i = 0; i < compareCount; i++) {
            const drift = 1 - this.computeSimilarity(
                recentOutputs[i].output,
                baselineOutputs[i].output
            );
            driftSum += drift;
        }

        return driftSum / compareCount;
    }

    private calculateConfidence(): number {
        // Confidence based on stability and consistency
        const stability = this.calculateOutputStability();
        const hallucinationRate = this.estimateHallucinationRate();
        
        return stability * (1 - hallucinationRate);
    }

    private detectAnomalies(): boolean {
        if (this.outputHistory.length < 5) return false;

        // Check recent outputs for sudden changes
        const recent = this.outputHistory.slice(-5);
        const previous = this.outputHistory.slice(-10, -5);

        if (previous.length === 0) return false;

        let anomalyScore = 0;
        for (const recentEntry of recent) {
            let minSimilarity = 1.0;
            for (const prevEntry of previous) {
                const similarity = this.computeSimilarity(recentEntry.output, prevEntry.output);
                minSimilarity = Math.min(minSimilarity, similarity);
            }
            anomalyScore += (1 - minSimilarity);
        }

        anomalyScore /= recent.length;
        return anomalyScore > 0.7;
    }

    private computeSimilarity(output1: any, output2: any): number {
        // Simple similarity computation
        // In production, use perceptual hashing or feature extraction
        
        if (typeof output1 === 'string' && typeof output2 === 'string') {
            // String similarity
            const longer = output1.length > output2.length ? output1 : output2;
            const shorter = output1.length > output2.length ? output2 : output1;
            
            if (longer.length === 0) return 1.0;
            
            const editDistance = this.levenshteinDistance(output1, output2);
            return (longer.length - editDistance) / longer.length;
        }
        
        // For other types, use simple equality
        return output1 === output2 ? 1.0 : 0.5;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    private checkHealthIssues(metrics: HealthMetrics): void {
        const issues: { message: string; severity: 'low' | 'medium' | 'high' }[] = [];

        if (metrics.outputStability < this.thresholds.minStability) {
            issues.push({
                message: `Low output stability: ${(metrics.outputStability * 100).toFixed(1)}%`,
                severity: 'medium'
            });
        }

        if (metrics.hallucinationRate > this.thresholds.maxHallucinationRate) {
            issues.push({
                message: `High hallucination rate: ${(metrics.hallucinationRate * 100).toFixed(1)}%`,
                severity: 'high'
            });
        }

        if (metrics.driftScore > this.thresholds.maxDriftScore) {
            issues.push({
                message: `Model drift detected: ${(metrics.driftScore * 100).toFixed(1)}%`,
                severity: 'medium'
            });
        }

        if (metrics.confidenceLevel < this.thresholds.minConfidence) {
            issues.push({
                message: `Low confidence: ${(metrics.confidenceLevel * 100).toFixed(1)}%`,
                severity: 'low'
            });
        }

        if (metrics.anomalyDetected) {
            issues.push({
                message: 'Anomaly detected in recent outputs',
                severity: 'high'
            });
        }

        // Trigger alerts
        for (const issue of issues) {
            this.alertCallbacks.forEach(callback => callback(issue.message, issue.severity));
        }
    }

    /**
     * Get health report
     */
    public getHealthReport(): {
        current: HealthMetrics;
        baseline: HealthMetrics | null;
        trend: 'improving' | 'stable' | 'degrading';
        recommendations: string[];
    } {
        const current = this.calculateHealthMetrics();
        
        let trend: 'improving' | 'stable' | 'degrading' = 'stable';
        if (this.baselineMetrics) {
            const currentScore = this.getOverallHealthScore(current);
            const baselineScore = this.getOverallHealthScore(this.baselineMetrics);
            
            if (currentScore > baselineScore + 0.1) {
                trend = 'improving';
            } else if (currentScore < baselineScore - 0.1) {
                trend = 'degrading';
            }
        }

        const recommendations = this.generateRecommendations(current);

        return {
            current,
            baseline: this.baselineMetrics,
            trend,
            recommendations
        };
    }

    private getOverallHealthScore(metrics: HealthMetrics): number {
        return (
            metrics.outputStability * 0.3 +
            (1 - metrics.hallucinationRate) * 0.3 +
            (1 - metrics.driftScore) * 0.2 +
            metrics.confidenceLevel * 0.2
        );
    }

    private generateRecommendations(metrics: HealthMetrics): string[] {
        const recommendations: string[] = [];

        if (metrics.outputStability < this.thresholds.minStability) {
            recommendations.push('Consider increasing model regularization');
            recommendations.push('Review training data for consistency');
        }

        if (metrics.hallucinationRate > this.thresholds.maxHallucinationRate) {
            recommendations.push('Implement stricter output validation');
            recommendations.push('Increase training on edge cases');
        }

        if (metrics.driftScore > this.thresholds.maxDriftScore) {
            recommendations.push('Consider retraining or fine-tuning');
            recommendations.push('Review recent changes to input distribution');
        }

        if (metrics.anomalyDetected) {
            recommendations.push('Investigate recent anomalous outputs');
            recommendations.push('Consider rolling back to previous version');
        }

        return recommendations;
    }

    /**
     * Reset baseline metrics
     */
    public resetBaseline(): void {
        this.baselineMetrics = this.calculateHealthMetrics();
        console.log('Baseline metrics reset');
    }
}
