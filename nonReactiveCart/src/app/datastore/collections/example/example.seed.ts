// import { generateId, generateIntegersInRange, randomiseList } from 'src/util';
// import { Example } from './example.model';

// export interface GenerateExampleOption {
//   readonly id?: number;
//   readonly userId?: number;
//   readonly description?: string;
//   readonly createTime?: number;
// }

// export interface GenerateExamplesOptions {
//   readonly userIds?: readonly number[];
// }

// export function generateExampleObjects({
//   userIds,
// }: GenerateExamplesOptions): readonly Example[] {
//   const generatedUserIds = userIds ?? generateRandomUserIds();

//   return generatedUserIds.map((userId) =>
//     generateExampleObject({
//       userId,
//     })
//   );
// }

// export function generateExampleObject({
//   id = generateId(),
//   userId = generateId(),
//   description = 'This test description for example collection',
//   createTime = Date.now(),
// }: GenerateExampleOption = {}): Example {
//   return {
//     id,
//     userId,
//     createTime,
//     description,
//   };
// }

// function generateRandomUserIds(count = 5): readonly number[] {
//   return randomiseList(
//     generateIntegersInRange(100, count * 100, count),
//     'userIds'
//   );
// }
