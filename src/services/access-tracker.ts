import { db } from '../libraries/db';
import { DB_COLLECTIONS } from '../constants';

// Create a collection for tracking school access
const accessCollection = db.openDB({ name: 'schoolAccess' });

interface SchoolAccess {
  schoolCode: string;
  regionCode: string;
  count: number;
  lastAccessed: Date;
}

/**
 * Track when a school's meal data is accessed
 */
export function trackSchoolAccess(schoolCode: string, regionCode: string): void {
  try {
    const key = `${regionCode}_${schoolCode}`;
    const existing = accessCollection.get(key) as SchoolAccess | null;

    if (existing) {
      accessCollection.put(key, {
        ...existing,
        count: existing.count + 1,
        lastAccessed: new Date(),
      });
    } else {
      accessCollection.put(key, {
        schoolCode,
        regionCode,
        count: 1,
        lastAccessed: new Date(),
      });
    }
  } catch (error) {
    // Silently fail - tracking is not critical
    console.error('Failed to track school access:', error);
  }
}

/**
 * Get the most frequently accessed schools
 */
export function getPopularSchools(limit: number = 20): { schoolCode: string; regionCode: string }[] {
  try {
    const schools: SchoolAccess[] = [];

    // Get all school access records
    for (const key of accessCollection.getKeys()) {
      const keyStr = String(key);
      const record = accessCollection.get(keyStr) as SchoolAccess;
      if (record) {
        schools.push(record);
      }
    }

    // Sort by access count (descending) and filter recent ones
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return schools
      .filter(s => new Date(s.lastAccessed) > thirtyDaysAgo) // Only schools accessed in last 30 days
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ schoolCode, regionCode }) => ({ schoolCode, regionCode }));
  } catch (error) {
    console.error('Failed to get popular schools:', error);
    // Return fallback schools if tracking fails
    return [
      { schoolCode: '7010908', regionCode: 'B10' }, // 선린인터넷고
      { schoolCode: '7010536', regionCode: 'B10' }, // Example school
    ];
  }
}

/**
 * Clean up old access records (older than 90 days)
 */
export function cleanupOldAccessRecords(): void {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const key of accessCollection.getKeys()) {
      const keyStr = String(key);
      const record = accessCollection.get(keyStr) as SchoolAccess;
      if (record && new Date(record.lastAccessed) < ninetyDaysAgo) {
        accessCollection.remove(keyStr);
      }
    }

    console.log('Cleaned up old access records');
  } catch (error) {
    console.error('Failed to cleanup old access records:', error);
  }
}