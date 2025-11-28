

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { BuildingConfig, BuildingType } from './types';

// Map Settings
export const GRID_SIZE = 25;

// Game Settings
export const TICK_RATE_MS = 2000; // Game loop updates every 2 seconds
export const INITIAL_MONEY = 50000; // Increased starting money to allow buying expensive land/trains
export const LAND_COST = 500; // Base cost, overridden by tile specific price
export const LAND_SELL = 250; // Base sell, overridden by tile specific price

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.None]: {
    type: BuildingType.None,
    cost: 0,
    name: 'Bulldoze',
    description: 'Clear a tile',
    color: '#ef4444', // Used for UI
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Road]: {
    type: BuildingType.Road,
    cost: 10,
    name: 'Road',
    description: 'Connects buildings.',
    color: '#374151', // gray-700
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Residential]: {
    type: BuildingType.Residential,
    cost: 100,
    name: 'House',
    description: '+5 Pop/day',
    color: '#f87171', // red-400
    popGen: 5,
    incomeGen: 0,
  },
  [BuildingType.Commercial]: {
    type: BuildingType.Commercial,
    cost: 200,
    name: 'Shop',
    description: '+$15/day',
    color: '#60a5fa', // blue-400
    popGen: 0,
    incomeGen: 15,
  },
  [BuildingType.Industrial]: {
    type: BuildingType.Industrial,
    cost: 400,
    name: 'Factory',
    description: '+$40/day',
    color: '#facc15', // yellow-400
    popGen: 0,
    incomeGen: 40,
  },
  [BuildingType.Park]: {
    type: BuildingType.Park,
    cost: 50,
    name: 'Park',
    description: 'Looks nice.',
    color: '#4ade80', // green-400
    popGen: 1,
    incomeGen: 0,
  },
  [BuildingType.Rail]: {
    type: BuildingType.Rail,
    cost: 150,
    name: 'Rail',
    description: 'Tracks for trains',
    color: '#57534e', // stone-600
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.TrainStation]: {
    type: BuildingType.TrainStation,
    cost: 5000,
    name: 'Station',
    description: '+$200/day',
    color: '#dc2626', // red-600
    popGen: 10,
    incomeGen: 200,
  },
  [BuildingType.Bridge]: {
    type: BuildingType.Bridge,
    cost: 1000,
    name: 'Bridge',
    description: 'Cross water',
    color: '#d97706', // amber-600
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Land]: {
    type: BuildingType.Land,
    cost: LAND_COST,
    name: 'Real Estate',
    description: 'Buy/Sell Land',
    color: '#8b5cf6', // violet-500
    popGen: 0,
    incomeGen: 0,
  },
};