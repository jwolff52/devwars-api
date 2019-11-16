import * as _ from 'lodash';
import * as chai from 'chai';
import * as express from 'express';
import * as supertest from 'supertest';
import { EntityManager, getManager } from 'typeorm';

import { UserSeeding, UserProfileSeeding } from '../app/seeding';
import { IProfileRequest } from '../app/request/IProfileRequest';
import { cookieForUser } from './helpers';
import ServerService from '../app/services/Server.service';

import UserProfile, { Sex } from '../app/models/UserProfile';
import { UserRole } from '../app/models/User';

import './setup';

const server: ServerService = new ServerService();
let app: express.Application;

// used for the creation of the database transactions without the need of constantly calling into
// get manager everytime a test needs a transaction.
const connectionManager: EntityManager = getManager();

const userProfileSettings: any | IProfileRequest = {
    firstName: 'damien',
    lastName: 'test',
    dob: new Date(),
    sex: Sex.MALE,
    about: 'i am the about me',
    forHire: true,
    company: 'Big one',
    websiteUrl: 'https://google.com',
    addressOne: 'address one line',
    addressTwo: 'address two line',
    city: 'Big City',
    state: 'USA',
    zip: '595959',
    country: 'France',
    skills: {
        html: 0,
        css: 3,
        js: 2,
    },
};

describe('user-profile', () => {
    before(async () => {
        await server.Start();
        app = server.App();
    });

    it("PATCH - /users/:userId/profile - should update a user's settings", async () => {
        const user = UserSeeding.default();
        const userProfile = UserProfileSeeding.withUser(user);

        await connectionManager.transaction(async (transaction) => {
            await transaction.save(user);
            await transaction.save(userProfile);
        });

        const response = await supertest(app)
            .patch(`/users/${user.id}/profile`)
            .set('cookie', await cookieForUser(user))
            .send(userProfileSettings);

        chai.expect(response.status).to.be.eq(200);

        const data: any = await UserProfile.findOne({ where: { user: user.id } });
        const filteredData = _.pick(data, Object.keys(userProfileSettings));

        // Perform a deep equal to directly compare the two objects and
        // all the objects nested levels until completion or invalid matching.
        chai.expect(filteredData).to.be.deep.equal(userProfileSettings);
    });

    it('PATCH - /users/:userId/profile - mod should not update another user profile', async () => {
        const userModerator = UserSeeding.withRole(UserRole.MODERATOR);
        const user = UserSeeding.withRole(UserRole.USER);

        await connectionManager.transaction(async (transaction) => {
            await transaction.save(userModerator);
            await transaction.save(user);
        });

        const response = await supertest(app)
            .patch(`/users/${user.id}/profile`)
            .set('cookie', await cookieForUser(userModerator))
            .send(userProfileSettings);

        chai.expect(response.status).to.be.eq(403);
    });

    it('PATCH - /users/:userId/profile - admin should update another user profile', async () => {
        const user = UserSeeding.withRole(UserRole.USER);
        const userProfile = UserProfileSeeding.withUser(user);
        const userAdministrator = UserSeeding.withRole(UserRole.ADMIN);

        await connectionManager.transaction(async (transaction) => {
            await transaction.save(user);
            await transaction.save(userProfile);
            await transaction.save(userAdministrator);
        });

        const response = await supertest(app)
            .patch(`/users/${user.id}/profile`)
            .set('cookie', await cookieForUser(userAdministrator))
            .send(userProfileSettings);

        chai.expect(response.status).to.be.eq(200);
    });
});
