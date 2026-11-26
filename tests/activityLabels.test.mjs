import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, describe, isThisComputer } from '../src/staff/activityLabels.js';

test('a logged action reads as plain words, with the record it was about', () => {
    assert.deepEqual(describe({ action: 'POST Reservations.Create', entityName: 'Reservations', entityId: '41' }),
        { label: 'Booked a unit', raw: 'POST Reservations.Create', record: 'Booking', recordId: '41', link: null });
    assert.equal(describe({ action: 'POST TicketQueue.Assign', entityName: 'TicketQueue', entityId: '7' }).link, '/admin/tickets/7');
});

test('sign-ins old and new read the same, and carry no record', () => {
    for (const action of ['LOGIN', 'POST Auth.Login']) {
        const d = describe({ action, entityName: 'User', entityId: '5' });
        assert.equal(d.label, 'Signed in');
        assert.equal(d.record, null);
    }
});

test('an unknown action shows as recorded', () => {
    assert.equal(describe({ action: 'POST Something.New', entityName: 'Something' }).label, 'POST Something.New');
});

test('every area names only parts of the system, and the loopback address is this computer', () => {
    assert.ok(AREAS.every((a) => /^[A-Za-z]+(,[A-Za-z]+)*$/.test(a.value)));
    assert.ok(isThisComputer('::1') && isThisComputer('127.0.0.1') && !isThisComputer('10.0.0.5'));
});
