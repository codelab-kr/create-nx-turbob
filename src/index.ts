import { select } from "@inquirer/prompts";
import { execSync } from "child_process";
import { program } from "commander";
import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

const getPnpmVersion = () => {
  try {
    return execSync("pnpm --version", { encoding: "utf8" }).trim();
  } catch (error) {
    console.warn("Could not determine pnpm version. Using default.");
    return "9.7.0"; // Fallback version
  }
};

const createPackage = (
  packageName: string,
  files: { [key: string]: string },
  options?: {
    scripts?: { [key: string]: string };
  }
) => {
  const packageDir = path.join("packages", packageName);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(path.join(packageDir, "src"));

  const packageJson = {
    name: `@repo/${packageName}`,
    private: true,
    type: "module",
    exports: {
      ".": {
        types: "./src/index.ts",
        default: "./dist/index.js",
      },
    },
    scripts: {
      build: "tsup --clean",
      "check-types": "tsc --noEmit",
      dev: "tsup --watch",
      ...options?.scripts,
    },
  };
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  const tsConfig = {
    extends: "@repo/typescript-config/base.json",
    compilerOptions: {
      outDir: "./dist",
    },
    include: ["src/**/*"],
    exclude: ["node_modules"],
  };
  fs.writeFileSync(
    path.join(packageDir, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2)
  );

  const tsupConfig = `
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
});
`;
  fs.writeFileSync(path.join(packageDir, "tsup.config.ts"), tsupConfig);

  Object.entries(files).forEach(([filePath, content]) => {
    const fullPath = path.join(packageDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  });

  console.log(`Installing dependencies for ${packageName} package...`);
  execSync("pnpm add -D tsup typescript @repo/typescript-config@workspace:*", {
    stdio: "inherit",
    cwd: packageDir,
  });
};

const initializeMonorepo = async (appName: string) => {
  // Create root directory
  fs.mkdirSync(appName);
  process.chdir(appName);

  // Initialize pnpm workspace
  fs.writeFileSync(
    "pnpm-workspace.yaml",
    'packages:\n  - "apps/*"\n  - "packages/*"\n'
  );

  // Create apps and packages directories
  fs.mkdirSync("apps");
  fs.mkdirSync("packages");

  // Initialize package.json
  const pnpmVersion = getPnpmVersion();
  const packageJson = {
    name: appName,
    private: true,
    packageManager: `pnpm@${pnpmVersion}`,
    scripts: {
      build: "turbo run build",
      dev: "turbo run dev",
      lint: "turbo run lint",
      "check-types": "turbo run check-types",
      test: "turbo run test",
    },
    devDependencies: {
      turbo: "latest",
    },
  };
  fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

  // Install @types/node
  console.log("Installing @types/node...");
  execSync("pnpm add -w -D @types/node", { stdio: "inherit" });

  // Create turbo.json
  const turboConfig = {
    $schema: "https://turbo.build/schema.json",
    ui: "tui",
    tasks: {
      build: {
        dependsOn: ["^build"],
        inputs: ["$TURBO_DEFAULT$", ".env*"],
        outputs: [".next/**", "!.next/cache/**", "dist/**"],
      },
      "check-types": {
        dependsOn: ["^check-types"],
      },
      dev: {
        cache: false,
        persistent: true,
      },
      test: {
        cache: false,
        persistent: true,
      },
    },
  };
  const formattedTurboConfig = await prettier.format(
    JSON.stringify(turboConfig),
    { parser: "json" }
  );
  fs.writeFileSync("turbo.json", formattedTurboConfig);

  // Initialize TypeScript config
  fs.mkdirSync("packages/typescript-config", { recursive: true });

  // Create package.json for typescript-config
  const tsConfigPackageJson = {
    name: "@repo/typescript-config",
    version: "1.0.0",
    private: true,
    license: "MIT",
    publishConfig: {
      access: "public",
    },
  };
  fs.writeFileSync(
    "packages/typescript-config/package.json",
    JSON.stringify(tsConfigPackageJson, null, 2)
  );

  // Install latest @tsconfig/node20
  console.log("Installing latest @tsconfig/node20...");
  execSync("pnpm add -D @tsconfig/node20", {
    stdio: "inherit",
    cwd: "packages/typescript-config",
  });

  // Create tsconfig base
  const tsConfigBase = {
    $schema: "https://json.schemastore.org/tsconfig",
    extends: "@tsconfig/node20/tsconfig.json",
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "Bundler",
    },
  };
  fs.writeFileSync(
    "packages/typescript-config/base.json",
    JSON.stringify(tsConfigBase, null, 2)
  );

  // Initialize Docker Compose config
  const dockerComposeConfig = `
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${appName.replace(/-/g, "_")}_dev
    ports:
      - "5432:5432"
    volumes:
      - /var/lib/postgresql/data

  redis:
    image: redis:6.2-alpine
    ports:
      - "6379:6379"
`;
  fs.mkdirSync("packages/docker-dev");
  fs.writeFileSync("packages/docker-dev/compose.yml", dockerComposeConfig);

  const dockerDevPackageJson = {
    name: "@repo/docker-dev",
    private: true,
    scripts: {
      dev: "docker compose up",
      "db:reset":
        "docker compose rm --force --stop postgres && docker compose up -d",
    },
    devDependencies: {
      typescript: "^5.5.4",
    },
  };
  fs.writeFileSync(
    "packages/docker-dev/package.json",
    JSON.stringify(dockerDevPackageJson, null, 2)
  );

  // Create .gitignore file
  const gitignoreContent = `
# Dependencies
node_modules

# Builds
.next/
dist/

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Turbo
.turbo
`;

  fs.writeFileSync(".gitignore", gitignoreContent.trim());

  // Install dependencies
  console.log("Installing dependencies...");
  execSync("pnpm install", { stdio: "inherit" });

  // Initialize db package
  createPackage(
    "db",
    {
      "prisma/schema.prisma": `
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Post {
  id        String   @id @db.VarChar(12)
  userId    String   @db.VarChar(12)
  user      User     @relation(fields: [userId], references: [id])
  content   String   @db.VarChar(240)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("posts")
}

model User {
  id        String   @id @db.VarChar(12)
  username  String   @unique @db.VarChar(32)
  name      String   @db.VarChar(32)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  posts Post[]

  @@map("users")
}
`,
      "src/util.ts": `
import { customAlphabet } from "nanoid";

export const genId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  12
);
`,
      "src/index.ts": `
export { Prisma, PrismaClient } from "@prisma/client";
export type { Post as PostEntity, User as UserEntity } from "@prisma/client";
export { db } from "./db";
export { genId } from "./util";
`,
      "src/db.ts": `
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

let db: PrismaClient;

const isServer =
  typeof process !== "undefined" && process.versions && process.versions.node;
if (isServer) {
  if (process.env.NODE_ENV === "production") {
    db = new PrismaClient();
  } else {
    if (!global.prisma) {
      global.prisma = new PrismaClient({
        log: ["query", "info", "warn", "error"],
      });
    }
    db = global.prisma;
  }
}

export { db };
`,
    },
    {
      scripts: {
        build: "pnpm build:prisma && tsup --clean",
        "build:prisma": "prisma generate",
        "check-types": "tsc --noEmit",
        dev: "tsup --watch",
        migrate: "prisma migrate",
        push: "prisma db push",
      },
    }
  );
  console.log("Installing additional dependencies for db package...");
  const dbDir = path.join("packages", "db");
  execSync("pnpm add @prisma/client nanoid", {
    stdio: "inherit",
    cwd: dbDir,
  });
  execSync("pnpm add -D prisma", {
    stdio: "inherit",
    cwd: dbDir,
  });

  createPackage("queue", {
    "src/index.ts": `
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const QUEUE_NAME = "queue";
export const queue = new Queue(QUEUE_NAME, { connection: redis });

export enum JobType {
  GeneratePosts = "generate-posts",
}

export type JobData = {
  [JobType.GeneratePosts]: { count: number };
};

export async function enqueue<T extends JobType>(type: T, data: JobData[T]) {
  return queue.add(type, data);
}

const queueEvents = new QueueEvents(QUEUE_NAME);
export async function enqueueAndWait<T extends JobType>(
  type: T,
  data: JobData[T]
) {
  const job = await enqueue(type, data);
  await job.waitUntilFinished(queueEvents);
  return job;
}
`,
  });

  console.log("Installing additional dependencies for queue package...");
  execSync("pnpm add bullmq ioredis", {
    stdio: "inherit",
    cwd: path.join("packages", "queue"),
  });

  console.log(`Monorepo ${appName} initialized successfully!`);
};

const initializeApp = async (name: string, type?: string) => {
  if (!type) {
    type = await select({
      message: "What type of app do you want to create?",
      choices: [
        { name: "Next.js", value: "next" },
        { name: "Node.js", value: "node" },
      ],
    });
  }

  const appDir = path.join("apps", name);
  fs.mkdirSync(appDir, { recursive: true });

  if (type === "next") {
    execSync(
      `npx create-next-app@latest ${appDir} --typescript --eslint --use-pnpm`,
      { stdio: "inherit" }
    );

    // Install db package for Next.js apps
    console.log("Installing @repo/db package...");
    execSync("pnpm add @repo/db@workspace:*", {
      stdio: "inherit",
      cwd: appDir,
    });
  } else if (type === "node") {
    // Initialize Node.js app
    const packageJson = {
      name: `@repo/${name}`,
      private: true,
      type: "module",
      scripts: {
        build: "tsup --clean",
        "check-types": "tsc --noEmit",
        dev: "tsup --watch --onSuccess 'pnpm start'",
        start: "node dist/index.js",
      },
    };
    fs.writeFileSync(
      path.join(appDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create tsup.config.ts
    const tsupConfig = `
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
});
`;
    fs.writeFileSync(path.join(appDir, "tsup.config.ts"), tsupConfig);

    // Create tsconfig.json
    const tsConfig = {
      extends: "@repo/typescript-config/base.json",
    };
    fs.writeFileSync(
      path.join(appDir, "tsconfig.json"),
      JSON.stringify(tsConfig, null, 2)
    );

    // Create src/index.ts
    fs.mkdirSync(path.join(appDir, "src"));
    fs.writeFileSync(
      path.join(appDir, "src", "index.ts"),
      'console.log("Hello, World!");'
    );

    // Install dependencies including latest tsup and typescript
    console.log("Installing dependencies for the Node.js app...");
    execSync("pnpm add @repo/typescript-config@workspace:*", {
      stdio: "inherit",
      cwd: appDir,
    });
    execSync("pnpm add -D tsup typescript", {
      stdio: "inherit",
      cwd: appDir,
    });
  }

  console.log(`App ${name} initialized successfully!`);
};

program
  .name("k4")
  .description("CLI to bootstrap and manage pnpm/turborepo monorepos")
  .version("0.1.0");

program
  .command("init <name>")
  .description("Initialize a new monorepo")
  .action(initializeMonorepo);

program
  .command("app <name>")
  .description("Initialize a new app in the monorepo")
  .option("--next", "Create a Next.js app")
  .option("--node", "Create a Node.js app")
  .action((name, options) => {
    const type = options.next ? "next" : options.node ? "node" : undefined;
    initializeApp(name, type);
  });

program.parse();
