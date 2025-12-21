// app/utils/dataArchiving.ts
// Data Archiving Utilities for Old Records

import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
  limit,
  doc,
} from "firebase/firestore";

const ARCHIVE_COLLECTION = "ARCHIVED_RECORDS";
const ARCHIVE_THRESHOLD_YEARS = 2; // Archive records older than 2 years

export interface ArchiveConfig {
  userId: string;
  archiveThresholdYears?: number;
  batchSize?: number;
}

/**
 * Archive old expense records
 * Moves records older than threshold to archive collection
 */
export async function archiveOldExpenses(
  config: ArchiveConfig
): Promise<{ archived: number; errors: number }> {
  const {
    userId,
    archiveThresholdYears = ARCHIVE_THRESHOLD_YEARS,
    batchSize = 500,
  } = config;

  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  const thresholdDate = new Date();
  thresholdDate.setFullYear(thresholdDate.getFullYear() - archiveThresholdYears);
  const thresholdTimestamp = Timestamp.fromDate(thresholdDate);

  let archived = 0;
  let errors = 0;

  try {
    // Query old expenses
    const q = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", "<", thresholdTimestamp),
      limit(batchSize)
    );

    const snap = await getDocs(q);
    const docs = snap.docs;

    if (docs.length === 0) {
      console.log("✅ No old expenses to archive");
      return { archived: 0, errors: 0 };
    }

    // Batch write to archive collection
    const batch = writeBatch(db);
    const archiveBatch = writeBatch(db);

    docs.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Add to archive collection
      const archiveRef = doc(collection(db, ARCHIVE_COLLECTION, userId, "EXPENSES"), docSnap.id);
      archiveBatch.set(archiveRef, {
        ...data,
        archivedAt: Timestamp.now(),
        originalCollection: "EXPENSES",
      });

      // Delete from original collection
      batch.delete(docSnap.ref);
    });

    await Promise.all([batch.commit(), archiveBatch.commit()]);
    archived = docs.length;

    console.log(`✅ Archived ${archived} expense records`);
  } catch (error) {
    console.error("❌ Error archiving expenses:", error);
    errors++;
  }

  return { archived, errors };
}

/**
 * Archive old income records
 */
export async function archiveOldIncomes(
  config: ArchiveConfig
): Promise<{ archived: number; errors: number }> {
  const {
    userId,
    archiveThresholdYears = ARCHIVE_THRESHOLD_YEARS,
    batchSize = 500,
  } = config;

  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  const thresholdDate = new Date();
  thresholdDate.setFullYear(thresholdDate.getFullYear() - archiveThresholdYears);
  const thresholdTimestamp = Timestamp.fromDate(thresholdDate);

  let archived = 0;
  let errors = 0;

  try {
    const q = query(
      collection(db, "INCOME"),
      where("user_id", "==", userPath),
      where("inc_date", "<", thresholdTimestamp),
      limit(batchSize)
    );

    const snap = await getDocs(q);
    const docs = snap.docs;

    if (docs.length === 0) {
      console.log("✅ No old income records to archive");
      return { archived: 0, errors: 0 };
    }

    const batch = writeBatch(db);
    const archiveBatch = writeBatch(db);

    docs.forEach((docSnap) => {
      const data = docSnap.data();
      
      const archiveRef = doc(collection(db, ARCHIVE_COLLECTION, userId, "INCOME"), docSnap.id);
      archiveBatch.set(archiveRef, {
        ...data,
        archivedAt: Timestamp.now(),
        originalCollection: "INCOME",
      });

      batch.delete(docSnap.ref);
    });

    await Promise.all([batch.commit(), archiveBatch.commit()]);
    archived = docs.length;

    console.log(`✅ Archived ${archived} income records`);
  } catch (error) {
    console.error("❌ Error archiving income records:", error);
    errors++;
  }

  return { archived, errors };
}

/**
 * Restore archived records (if needed)
 */
export async function restoreArchivedRecords(
  userId: string,
  collectionName: "EXPENSES" | "INCOME",
  recordIds: string[]
): Promise<{ restored: number; errors: number }> {
  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  let restored = 0;
  let errors = 0;

  try {
    const batch = writeBatch(db);
    const restoreBatch = writeBatch(db);

    for (const recordId of recordIds) {
      try {
        const archiveRef = doc(
          collection(db, ARCHIVE_COLLECTION, userId, collectionName),
          recordId
        );
        
        const archiveDoc = await getDoc(archiveRef);
        if (!archiveDoc.exists()) {
          errors++;
          continue;
        }

        const data = archiveDoc.data();
        const { archivedAt, originalCollection, ...originalData } = data;

        // Restore to original collection
        const originalRef = doc(collection(db, collectionName), recordId);
        restoreBatch.set(originalRef, originalData);

        // Delete from archive
        batch.delete(archiveRef);
        restored++;
      } catch (error) {
        console.error(`❌ Error restoring record ${recordId}:`, error);
        errors++;
      }
    }

    await Promise.all([batch.commit(), restoreBatch.commit()]);
    console.log(`✅ Restored ${restored} records from archive`);
  } catch (error) {
    console.error("❌ Error restoring archived records:", error);
    errors++;
  }

  return { restored, errors };
}

/**
 * Get archive statistics
 */
export async function getArchiveStats(userId: string): Promise<{
  archivedExpenses: number;
  archivedIncomes: number;
}> {
  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  
  try {
    const expensesRef = collection(db, ARCHIVE_COLLECTION, userPath, "EXPENSES");
    const incomesRef = collection(db, ARCHIVE_COLLECTION, userPath, "INCOME");

    const [expensesSnap, incomesSnap] = await Promise.all([
      getDocs(expensesRef),
      getDocs(incomesRef),
    ]);

    return {
      archivedExpenses: expensesSnap.size,
      archivedIncomes: incomesSnap.size,
    };
  } catch (error) {
    console.error("❌ Error getting archive stats:", error);
    return { archivedExpenses: 0, archivedIncomes: 0 };
  }
}
