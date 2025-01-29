import { faker } from '@faker-js/faker';
import { db, genId } from '@packages/db';
import { JobData, JobType } from '@packages/queue';

export const runGeneratePosts = async (
  data: JobData[JobType.GeneratePosts]
) => {
  const { count } = data;

  console.log(`Generating ${count}`);

  await db.$transaction(
    Array.from({ length: count }).map(() => {
      const data = {
        id: genId(),
        username: faker.internet.username(),
        fullName: faker.person.fullName(),
        content: faker.lorem.paragraph({ min: 1, max: 3 }),
        createdAt: faker.date.recent({ days: 30 }),
      };
      console.log(data);
      return db.post.create({
        data: {
          id: data.id,
          content: data.content,
          createdAt: data.createdAt,
          user: {
            connectOrCreate: {
              create: {
                id: genId(),
                name: data.fullName,
                username: data.username,
              },
              where: {
                username: data.username,
              },
            },
          },
        },
      });
    })
  );
};
