// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

context('Visual Designer', () => {
  beforeEach(() => {
    cy.visit('/home');
    cy.createBot('TodoSample');
    // Return to Main.dialog
    cy.findByTestId('ProjectTree').within(() => {
      cy.findAllByText('__TestTodoSample').last().click();
    });
  });

  it('can find Visual Designer default trigger in container', () => {
    cy.findByTestId('ProjectTree').within(() => {
      cy.findByText('Greeting').click();
    });

    cy.withinEditor('VisualEditor', () => {
      cy.findByText('ConversationUpdate activity').should('exist');
    });
  });
});
