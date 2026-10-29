import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Share, ShareRole } from '@api';
import { snackBarText } from '../../testing/routed-page';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { failFieldAsInvalid, GROCERIES } from '../../testing/todo-lists';

const SHARES = { method: 'POST', url: `/api/v1/todo-lists/${GROCERIES.id}/shares` };

const TARAS: Share = {
  userId: 9,
  email: 'taras@example.com',
  displayName: 'Taras',
  role: ShareRole.EDITOR,
};

describe('Sharing a Todo List', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function openShareDialog() {
    const page = await renderTodoListPage(GROCERIES);
    page.click('Share Todo List');
    await page.text();
    return page;
  }

  it('Shares it with a registered User by email, as a Viewer unless told otherwise', async () => {
    const page = await openShareDialog();
    expect(await page.chosen('Role')).toBe('Viewer');

    await page.fill('Email', ' taras@example.com ');
    await page.choose('Role', 'Editor');
    page.click('Share');
    const share = page.http.expectOne(SHARES);
    expect(share.request.body).toEqual({ email: 'taras@example.com', role: 'EDITOR' });
    share.flush(TARAS);

    await vi.waitFor(() => expect(snackBarText()).toContain('Shared “Groceries” with Taras.'));
    expect(document.querySelector('mat-dialog-container')).toBeNull();
  });

  it('asks for a valid email before sending anything', async () => {
    const page = await openShareDialog();

    page.click('Share');
    expect(await page.fieldErrors('Email')).toEqual(['Enter an email address.']);
    await page.fill('Email', 'taras');
    expect(await page.fieldErrors('Email')).toEqual(['Enter a valid email address.']);
    page.http.expectNone(SHARES);
  });

  it.each([
    ['NOT_REGISTERED', 'No one has registered with this email. Ask them to register first.'],
    ['OWNER', 'That’s your own email.'],
    ['ALREADY_SHARED', 'This Todo List is already Shared with them.'],
  ])('says why the backend refuses the email as %s', async (code, message) => {
    const page = await openShareDialog();

    await page.fill('Email', 'taras@example.com');
    page.click('Share');
    failFieldAsInvalid(page.http.expectOne(SHARES), 'email', code);

    expect(await page.fieldErrors('Email')).toEqual([message]);
    expect(await page.fieldValue('Email')).toBe('taras@example.com');
  });

  it("says so, keeping what was typed, when the server can't be reached", async () => {
    const page = await openShareDialog();

    await page.fill('Email', 'taras@example.com');
    page.click('Share');
    page.http.expectOne(SHARES).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.alerts()).toContain("Can't reach the server. Try again in a moment.");
    expect(await page.fieldValue('Email')).toBe('taras@example.com');
  });
});
