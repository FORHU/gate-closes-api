import { expect } from "chai";
import { describe, it } from "mocha";
import TerminalEchoRepo from "../src/repositories/terminal.echo.repository";

describe("Terminal Echo feed airport filter", () => {
  const matches = (input: string, echo: { airportIata?: string; airportName?: string }) => {
    const [byIata, byName] = TerminalEchoRepo.feedAirportFilter(input).$or as [
      { airportIata: string },
      { airportName: RegExp },
    ];
    return (
      echo.airportIata === byIata.airportIata ||
      (echo.airportName !== undefined && byName.airportName.test(echo.airportName))
    );
  };

  const naia = { airportIata: "MNL", airportName: "Ninoy Aquino International Airport" };

  it("matches the stored IATA code (Flutter sends the code)", () => {
    expect(matches("MNL", naia)).to.equal(true);
    expect(matches("mnl", naia)).to.equal(true);
  });

  it("matches the airport name (Expo sends the name)", () => {
    expect(matches("Ninoy Aquino", naia)).to.equal(true);
  });

  it("does not match another airport", () => {
    expect(matches("JFK", naia)).to.equal(false);
  });

  it("treats the input as text, not a pattern", () => {
    expect(matches(".*", naia)).to.equal(false);
    expect(() => TerminalEchoRepo.feedAirportFilter("(")).to.not.throw();
  });
});
