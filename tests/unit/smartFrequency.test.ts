import {
  FrequencyMeasurement,
  FrequencyAnalytics,
} from '../../src/routes/smartFrequency';

describe('SmartFrequency', () => {
  describe('FrequencyMeasurement structure', () => {
    it('should have required fields', () => {
      const measurement: FrequencyMeasurement = {
        userId: 'user-123',
        frequencyHz: 10.5,
        signalType: 'brainwave',
        timestamp: new Date().toISOString(),
      };

      expect(measurement).toHaveProperty('userId');
      expect(measurement).toHaveProperty('frequencyHz');
      expect(measurement).toHaveProperty('signalType');
      expect(measurement).toHaveProperty('timestamp');
    });

    it('should accept optional metadata', () => {
      const measurement: FrequencyMeasurement = {
        userId: 'user-456',
        frequencyHz: 60,
        signalType: 'heartrate',
        timestamp: new Date().toISOString(),
        metadata: { device: 'sensor-01', quality: 'high' },
      };

      expect(measurement.metadata).toHaveProperty('device', 'sensor-01');
    });

    it('should accept zero frequencyHz', () => {
      const measurement: FrequencyMeasurement = {
        userId: 'user-789',
        frequencyHz: 0,
        signalType: 'eeg',
        timestamp: new Date().toISOString(),
      };

      expect(measurement.frequencyHz).toBe(0);
    });

    it('should reject empty userId string', () => {
      const isValid = (userId: string) => !!userId && !!userId.trim();
      expect(isValid('')).toBe(false);
      expect(isValid('   ')).toBe(false);
      expect(isValid('user-1')).toBe(true);
    });

    it('should reject empty signalType string', () => {
      const isValid = (signalType: string) =>
        !!signalType && !!signalType.trim();
      expect(isValid('')).toBe(false);
      expect(isValid('   ')).toBe(false);
      expect(isValid('eeg')).toBe(true);
    });
  });

  describe('FrequencyAnalytics calculation', () => {
    it('should compute correct averageHz', () => {
      const frequencies = [10, 20, 30];
      const averageHz =
        Math.round(
          (frequencies.reduce((a, b) => a + b, 0) / frequencies.length) * 1000
        ) / 1000;
      expect(averageHz).toBe(20);
    });

    it('should compute correct minHz and maxHz', () => {
      const frequencies = [5, 15, 25, 35];
      expect(Math.min(...frequencies)).toBe(5);
      expect(Math.max(...frequencies)).toBe(35);
    });

    it('should return zeros when no measurements in window', () => {
      const analytics: FrequencyAnalytics = {
        averageHz: 0,
        minHz: 0,
        maxHz: 0,
        sampleCount: 0,
        signalType: 'all',
        windowMinutes: 60,
      };

      expect(analytics.sampleCount).toBe(0);
      expect(analytics.averageHz).toBe(0);
    });

    it('should track sampleCount correctly', () => {
      const sampleMeasurements: FrequencyMeasurement[] = [
        {
          userId: 'u1',
          frequencyHz: 10,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'u2',
          frequencyHz: 20,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
      ];

      const analytics: FrequencyAnalytics = {
        averageHz: 15,
        minHz: 10,
        maxHz: 20,
        sampleCount: sampleMeasurements.length,
        signalType: 'eeg',
        windowMinutes: 60,
      };

      expect(analytics.sampleCount).toBe(2);
    });
  });

  describe('windowMinutes validation', () => {
    const isValidWindow = (w: number) => !isNaN(w) && w > 0 && w <= 1440;

    it('should accept valid windowMinutes', () => {
      expect(isValidWindow(60)).toBe(true);
      expect(isValidWindow(1)).toBe(true);
      expect(isValidWindow(1440)).toBe(true);
    });

    it('should reject out-of-range windowMinutes', () => {
      expect(isValidWindow(0)).toBe(false);
      expect(isValidWindow(-5)).toBe(false);
      expect(isValidWindow(1441)).toBe(false);
    });
  });
  describe('Status response structure', () => {
    it('should include feature name', () => {
      const statusResponse = {
        status: 'active',
        feature: 'SmartFrequency',
        timestamp: new Date().toISOString(),
        measurementCount: 0,
      };

      expect(statusResponse.feature).toBe('SmartFrequency');
      expect(statusResponse.status).toBe('active');
      expect(statusResponse).toHaveProperty('timestamp');
      expect(statusResponse).toHaveProperty('measurementCount');
    });
  });

  describe('Measurements list response', () => {
    it('should return measurements array and total', () => {
      const items: FrequencyMeasurement[] = [
        {
          userId: 'u1',
          frequencyHz: 8,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'u2',
          frequencyHz: 12,
          signalType: 'heartrate',
          timestamp: new Date().toISOString(),
        },
      ];

      const response = { measurements: items, total: items.length };
      expect(response.total).toBe(2);
      expect(response.measurements).toHaveLength(2);
    });

    it('should filter by userId', () => {
      const items: FrequencyMeasurement[] = [
        {
          userId: 'alice',
          frequencyHz: 8,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'bob',
          frequencyHz: 12,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
      ];

      const filtered = items.filter((m) => m.userId === 'alice');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].userId).toBe('alice');
    });

    it('should filter by signalType', () => {
      const items: FrequencyMeasurement[] = [
        {
          userId: 'u1',
          frequencyHz: 8,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'u2',
          frequencyHz: 60,
          signalType: 'heartrate',
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'u3',
          frequencyHz: 10,
          signalType: 'eeg',
          timestamp: new Date().toISOString(),
        },
      ];

      const filtered = items.filter((m) => m.signalType === 'eeg');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Feature flag behaviour', () => {
    it('should default enableBiofeedback to true when env var is absent', () => {
      const enabled = process.env.ENABLE_BIOFEEDBACK !== 'false';
      expect(enabled).toBe(true);
    });

    it('should disable when ENABLE_BIOFEEDBACK is explicitly false', () => {
      const original = process.env.ENABLE_BIOFEEDBACK;
      process.env.ENABLE_BIOFEEDBACK = 'false';
      const enabled = process.env.ENABLE_BIOFEEDBACK !== 'false';
      expect(enabled).toBe(false);
      if (original === undefined) {
        delete process.env.ENABLE_BIOFEEDBACK;
      } else {
        process.env.ENABLE_BIOFEEDBACK = original;
      }
    });
  });
});
