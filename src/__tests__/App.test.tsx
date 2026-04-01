import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

describe('App', () => {
  it('renders signed-in deployment state', () => {
    render(<App />);
    expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('https://agentsmith.example.com');
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('user@example.com');
  });

  it('lists libraries newest first and toggles activation', async () => {
    render(<App />);
    const user = userEvent.setup();
    const libraries = screen.getAllByTestId(/desktop__library--/);
    expect(libraries[0]).toHaveTextContent('Design Assets');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));
    expect(screen.getByTestId('desktop__library-toggle--lib_2')).toHaveTextContent('Deactivate');
  });
});
