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

  it("renders the app title and language options", () => {
    renderInTestProvider(<App />);

    expect(screen.getByText("CanvaSync")).toBeDefined();
    expect(screen.getByText("ES")).toBeDefined();
    expect(screen.getByText("EN")).toBeDefined();
  });
});
