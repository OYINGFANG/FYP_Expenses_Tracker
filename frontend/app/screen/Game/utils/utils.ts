import {
  InGameDate,
  Price,
  Loan,
  LoanOffering,
  GameState,
  Capacity,
  VolWeight,
  Inventory,
  Flags,
  ItemsInfo,
  Product,
  Upgrade,
} from '../types';
import itemsData from '../data/itemsData';
import loansData from '../data/loansData';
import upgradesData from '../data/upgrades';
import { dateConfig, capacityData } from '../data/constants';

// Convert turns into in-game date
export const getInGameDate = (numTurns: number): InGameDate => {
  const daysInYear = dateConfig.numDaysInSeason * 4;
  const years = Math.floor(numTurns / daysInYear);
  const season = Math.floor((numTurns % daysInYear) / dateConfig.numDaysInSeason);
  const day = (numTurns % dateConfig.numDaysInSeason) + 1;
  return { day, season, years };
};

// Random number in a range
export const getRandRange = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min));

// Generate local item prices for a location and season
export const getLocalPrices = (location: string, numTurns: number): { [key: string]: Price } => {
  const daysInYear = dateConfig.numDaysInSeason * 4;
  const season = Math.floor((numTurns % daysInYear) / dateConfig.numDaysInSeason);
  const prices: { [key: string]: Price } = {};
  const normalizedLocation = String(location).toLowerCase();

  (Object.values(itemsData) as Product[]).forEach((item) => {
    const { itemId, volume, weight, prices: itemPrices } = item;
    const price = itemPrices.find(
      (p) => p.locations.map((loc) => String(loc).toLowerCase()).includes(normalizedLocation) && p.seasons.includes(season)
    );
    if (price) {
      const value = getRandRange(price.priceMin, price.priceMax);
      const qty = getRandRange(price.qtyMin, price.qtyMax);
      prices[itemId] = {
        id: itemId,
        value,
        actions: price.actions,
        qty,
        volume,
        weight,
        guildDiscount: price.guildDiscount,
      };
    }
  });

  return prices;
};

// Calculate net wealth
export const getNetWealth = (cash: number, savings: number, loans: Loan[]): number => {
  const loansTotal = loans.reduce((sum, loan) => sum + loan.principal, 0);
  return cash + savings - loansTotal;
};

// Get max capacity considering upgrades
export const getCapacityMax = (flags: Flags): VolWeight => {
  let max: VolWeight = capacityData[0];
  Object.keys(capacityData).forEach((key) => {
    if (flags[`upgrade__capacity_${key}`]) {
      max = capacityData[key];
    }
  });
  return max;
};

// Round to 2 decimal places
const sigFigs = (num: number) => Math.floor(num * 100) / 100;

// Calculate used vs max capacity
export const getCapacity = (inventory: Inventory, flags: Flags): Capacity => {
  const max = getCapacityMax(flags);
  let usedWeight = 0;
  let usedVolume = 0;

  Object.keys(inventory).forEach((key) => {
    const item = (itemsData as ItemsInfo)[key];
    if (item) {
      usedWeight += item.weight * inventory[key].qty;
      usedVolume += item.volume * inventory[key].qty;
    }
  });

  return {
    used: { weight: sigFigs(usedWeight), volume: sigFigs(usedVolume) },
    max,
  };
};

// Determine max purchasable quantity
export const getMaxQty = (
  gameState: GameState,
  selectedItem: { id: string; qty: number; value: number },
  itemsData: ItemsInfo
): number => {
  const itemData = itemsData[selectedItem.id];
  if (!itemData) {
    console.warn('Missing selected item id in itemsData:', selectedItem);
    return 1;
  }

  return Math.min(
    selectedItem.qty,
    Math.floor(gameState.cash / selectedItem.value),
    Math.floor((gameState.capacity.max.volume - gameState.capacity.used.volume) / itemData.volume),
    Math.floor((gameState.capacity.max.weight - gameState.capacity.used.weight) / itemData.weight)
  );
};

// Random 1d6 roll
export const getRnd1d6 = (): number => Math.floor(Math.random() * 6) + 1;

// Loan utilities
export const getHasLocalLoan = (loans: Loan[], location: string): boolean =>
  loans.some((loan) => loan.location === location);

export const getLoanByLocation = (loans: Loan[], location: string): Loan | undefined =>
  loans.find((loan) => loan.location === location);

export const getHasOverdueLoanForLocation = (gameState: GameState, location: string): boolean =>
  gameState.loans.some((loan) => loan.location === location && loan.dueDate < gameState.numTurns);

// Guild benefits
export const getGuildBenefitsByLocation = (location: string) => {
  const exclusiveItems: string[] = [];
  const exclusiveUpgrades: string[] = [];
  let exclusiveLoan = false;

  (Object.values(itemsData) as Product[]).forEach((item) => {
    if (item.prices.some((p) => p.locations.includes(location) && p.guildDiscount > 0)) {
      exclusiveItems.push(item.itemId);
    }
  });

  (Object.values(upgradesData) as Upgrade[]).forEach((upgrade) => {
    if (upgrade.prices.some((p) => p.locations.includes(location) && p.guildOnly)) {
      exclusiveUpgrades.push(upgrade.slug);
    }
  });

  (Object.values(loansData) as LoanOffering[]).forEach((loan) => {
    if (loan.location === location && loan.guildOnly) exclusiveLoan = true;
  });

  return { exclusiveItems, exclusiveUpgrades, exclusiveLoan };
};

// Determine map version based on upgrades
export const getMapVersion = (gameState: GameState): number => {
  if (gameState.flags['upgrade__map_2']) return 2;
  if (gameState.flags['upgrade__map_1']) return 1;
  return 0;
};
