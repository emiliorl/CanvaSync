import { screen } from "@testing-library/react";
import { App } from "src/intents/design_editor/app";
import { renderInTestProvider } from "src/utils/test_render";

jest.mock("@canva/app-hooks", () => ({
  useFeatureSupport: () => () => true,
}));

jest.mock("@canva/user", () => ({
  auth: {
    initOauth: () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
      requestAuthorization: jest.fn().mockResolvedValue({ status: "completed" }),
      deauthorize: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock("@canva/design", () => ({
  addElementAtPoint: jest.fn().mockResolvedValue(undefined),
  addElementAtCursor: jest.fn().mockResolvedValue(undefined),
  editContent: jest.fn().mockResolvedValue(undefined),
  getCurrentPageMetadata: jest.fn().mockResolvedValue({
    type: "absolute",
    dimensions: { width: 1920, height: 1080 },
  }),
}));

describe("CanvaSync BIM App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the app title, Google Sign-in button, and Sheet Link field", () => {
    renderInTestProvider(<App />);

    expect(screen.getByText("CanvaSync (BIM Bridge)")).toBeDefined();
    expect(screen.getByText("Sign in with Google")).toBeDefined();
    expect(screen.getByText("Google Sheet Link")).toBeDefined();
  });
});
