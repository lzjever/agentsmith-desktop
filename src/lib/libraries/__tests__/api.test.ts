import { fetchDesktopLibraries } from '../api';

describe('desktop libraries api', () => {
  it('loads desktop libraries with the current bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [
        {
          id: 'lib_2',
          workspace_id: 'ws_default',
          project_id: 'proj_demo',
          name: 'Design Assets',
          status: 'ready',
          created_at: '2026-04-01T12:00:00.000Z',
        },
      ],
    }), { status: 200 }));

    await expect(fetchDesktopLibraries({
      apiBaseUrl: 'https://api.agentsmith.example.com/api/v1',
      authSession: {
        access_token: 'token_a',
        refresh_token: 'refresh_a',
        expires_at: 123,
      },
      fetchImpl: fetchMock,
    })).resolves.toEqual([
      {
        id: 'lib_2',
        workspace_id: 'ws_default',
        project_id: 'proj_demo',
        name: 'Design Assets',
        status: 'ready',
        created_at: '2026-04-01T12:00:00.000Z',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.agentsmith.example.com/api/v1/me/desktop/file-libraries',
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer token_a',
        },
      },
    );
  });
});
