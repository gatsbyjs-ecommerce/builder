const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
const shell = require('shelljs');
const chalk = require('chalk');
const prompts = require('prompts');
const replace = require('replace-in-file');
const rimraf = require('rimraf');
const { capitalCase, paramCase } = require('change-case');

const createToken = require('./create-token');
const packageJson = require('../package.json');

const run = async () => {
  const { version } = packageJson;

  console.clear();
  console.log(chalk.magenta.bold('Lets build a e-commerce site.', version));
  console.log(
    chalk.white(
      'You are about to scaffold a project using Gatsby for the static site generation, Sanity as the CMS and Now.sh as the deployment platform.',
    ),
  );
  console.log(
    chalk.white(
      'Throughout this installation process, you will be asked to log in to Sanity.io to create the project, import the example dataset and deploy the initial GraphQL endpoint and also log in to ZEIT to automatically provision with environment variables.',
    ),
  );
  console.log(`Also, an ${chalk.yellow(
    '.env.build',
  )} file will be created to provision ${chalk.yellow(
    'now',
  )} with the required environment variables for local development.
  `);

  // console.log(chalk.magenta('Login to Sanity and Now.'));
  // execFileSync('sanity', ['login'], { stdio: 'inherit' });
  // execFileSync('now', ['login'], { stdio: 'inherit' });

  const response = await prompts([
    {
      type: 'text',
      name: 'siteName',
      message: 'What is your site Name?',
    },
    {
      type: 'text',
      name: 'siteUrl',
      message: 'What is your site URL?',
    },
    {
      type: 'text',
      name: 'adminEmail',
      message: 'What is site admin email?',
    },
  ]);
  const { siteName, siteUrl, adminEmail } = response;

  // Install Admin //
  console.log(chalk.magenta('Setting up Sanity Studio. \n'));
  if (shell.test('-d', 'packages/admin')) {
    console.log(
      chalk.blue('- Sanity Studio already exists, so skipping setup. \n'),
    );
  } else {
    console.log(chalk.blue('- Cloning fresh Sanity Studio. \n'));

    shell.exec(
      `git clone git@github.com:gatsbyjs-ecommerce/admin.git packages/admin`,
    );
  }
  // Install Admin //

  // Install Web //
  console.log(chalk.magenta('Setting up GatsbyJs frontend. \n'));
  if (shell.test('-d', 'packages/web')) {
    console.log(
      chalk.blue('- GatsbyJs site already exists, so skipping setup. \n'),
    );
  } else {
    console.log(chalk.blue('- Cloning fresh GatsbyJs site. \n'));

    shell.exec(
      `git clone git@github.com:gatsbyjs-ecommerce/web.git packages/web`,
    );
  }
  // Install Web //

  // Install Api //
  console.log(chalk.magenta('Setting up Apollo GraphQl API. \n'));
  if (shell.test('-d', 'packages/api')) {
    console.log(
      chalk.blue('- Apollo GraphQl API already exists, so skipping setup. \n'),
    );
  } else {
    console.log(chalk.blue('- Cloning fresh Apollo GraphQl API. \n'));

    shell.exec(
      `git clone git@github.com:gatsbyjs-ecommerce/api.git packages/api`,
    );
  }
  // Install Api //

  console.log(chalk.blue('Removing .git directories for projects. \n'));
  rimraf.sync(path.join(__dirname, '..', 'packages/admin/.git'));
  rimraf.sync(path.join(__dirname, '..', 'packages/api/.git'));
  rimraf.sync(path.join(__dirname, '..', 'packages/web/.git'));

  // Setup Admin //
  console.log(chalk.magenta('Lets create a Sanity Project.'));
  shell.cd(`packages/admin`);
  console.log('in dir', shell.pwd().stdout);
  execFileSync(
    'sanity',
    ['init', '--reconfigure', paramCase(siteName), '--dataset', 'production'],
    { stdio: 'inherit' },
  );
  await replace({
    files: path.join(__dirname, '..', 'packages/admin/sanity.json'),
    from: '--siteName--',
    to: capitalCase(siteName),
  });

  execFileSync('yarn', ['deploy-graphql'], { stdio: 'inherit' });

  const sanityToken = await createToken();

  const response2 = await prompts({
    type: 'select',
    name: 'confirm',
    message: () => `Do you want to import some dummy data into sanity?`,
    choices: [
      { title: 'Yes', value: 'yes' },
      { title: 'No', value: 'no' },
    ],
  });
  if (response2.confirm === 'yes') {
    shell.exec(`yarn run import`);
  }

  const sanityFile = path.join(
    __dirname,
    '..',
    'packages/admin',
    'sanity.json',
  );
  const sanityJSON = require(sanityFile);
  const { projectId, dataset } = sanityJSON.api;
  shell.cd('..');
  // Setup Admin //

  // Other updates //
  console.log(chalk.blue('Updating now.json for Zeit Now hosting. \n'));
  // set environment variables
  const envVars = [
    {
      name: 'SITE_NAME',
      value: capitalCase(siteName),
    },
    {
      name: 'WEB_APP_URL',
      value: siteUrl,
    },
    {
      name: 'ADMIN_EMAIL',
      value: adminEmail,
    },
    {
      name: 'JWTSECRET',
      value: 'random', // TODO:
    },
    {
      name: 'SANITY_PROJECT_ID',
      value: projectId,
    },
    {
      name: 'SANITY_DATASET',
      value: dataset,
    },
    {
      name: 'SANITY_TOKEN',
      value: sanityToken,
    },
  ];
  const nowFile = path.join(__dirname, '..', 'now.json');
  const nowJson = require(nowFile);
  const nowProjectName = paramCase(siteName);
  nowJson.name = nowProjectName;
  for (const e of envVars) {
    nowJson.build.env[e.name] = e.value;
  }
  fs.writeFileSync(nowFile, JSON.stringify(nowJson));
  shell.exec(`prettier --write ${path.join(__dirname, '..', 'now.json')}`);

  // web fixes
  await replace({
    files: path.join(__dirname, '..', 'packages/web/src/utils/config.js'),
    from: '--siteName--',
    to: capitalCase(siteName),
  });
  await replace({
    files: path.join(__dirname, '..', 'packages/web/src/utils/config.js'),
    from: '--siteUrl--',
    to: siteUrl,
  });
  await replace({
    files: path.join(__dirname, '..', 'packages/web/src/utils/config.js'),
    from: '--sanityId--',
    to: projectId,
  });

  // Other updates //

  // finish //

  console.clear();
  console.log(`
    ${chalk.green.bold('Done!')}
    Run ${chalk.yellow('yarn start')} to start a web server.
      - Navigate to http://localhost:3000 to preview your Gatsby application.
      - Navigate to http://localhost:3333 to open Sanity Studio.
    Run ${chalk.yellow(
      'cd admin && yarn deploy-graphql',
    )} to re-deploy your Sanity GraphQL endpoint AFTER changing your schema.
      (Remember to restart the web server in order to apply schema changes on Gatsby).
    Run ${chalk.yellow('yarn deploy')} to deploy to now.sh.
    Thank you for using this Gatsby E-commerce! ♥️
  `);

  process.exit(0);
  // finish //
};

run();
