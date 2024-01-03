import React from "react";
import PromptAuth from "./PromptAuth.js";
import "./styles.css";
import Sudo, { standardCatch } from "./Sudo.js";
import {
  CardElement,
  Elements,
  ElementsConsumer,
  PaymentElement
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import firebase from "./init-firebase.js";
import {
  onSnapshot,
  getFirestore,
  doc,
  getDocs,
  query,
  where,
  collection
} from "firebase/firestore";
import { states, countries } from "./countries.js";
import Bank from "./Bank/index.js";
import {
  browserSessionPersistence,
  getAuth,
  setPersistence,
  signOut
} from "firebase/auth";

const stripePromise = loadStripe(
  "pk_live_51OKNATFM5LbCaNp9oc0X1gSOihpvb9e9su7C437PRT0eApItNnLwpcLXCNgXxRyN5wC1W1l1CN68ThLrjyyjU36B008vSUhERN"
);
const firestore = getFirestore(firebase);
class User extends React.Component {
  state = {
    amount: 0,
    first: "",
    middle: "",
    last: "",
    billing_details: {
      first: "",
      middle: "",
      last: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: ""
    }
  };
  componentDidMount = () => {
    this.findUser();
  };
  componentDidUpdate = (prevProps) => {
    if (prevProps.pathname !== this.props.pathname) {
      this.findUser();
    }
  };
  findUser = () => {
    getDocs(
      query(
        collection(firestore, "users"),
        where("username", "==", this.props.pathname.split("/")[1])
      )
    ).then((querySnapshot) => {
      console.log("run");
      if (querySnapshot.empty) return null;
      this.setState({
        userFound: {
          ...querySnapshot.docs[0].data(),
          id: querySnapshot.docs[0].id
        }
      });
    });
  };
  render() {
    const inputStyle = {
      border: "0px dotted grey",
      borderRadius: "0px",
      width: "100%"
    };
    const codify = (e, entry) => {
      const output = (e.target.id === "country" ? countries : states).find(
        (x) => x.name.toUpperCase() === entry.toUpperCase()
      );
      return output
        ? output[e.target.id === "country" ? "alpha_2" : "abbreviation"]
        : entry;
    };

    const specialFormatting = (x, numbersOk) =>
      x
        .toLowerCase()
        //replace or regex a-z or A-Z includes space whitespace
        .replace(!numbersOk ? /[^a-zA-Z,']+/g : /[^a-zA-Z0-9,']+/g, " ")
        .split(" '")
        .map((word) => {
          var end = word.substring(1);
          var resword = word.charAt(0).toUpperCase() + end;
          return resword;
        })
        .join(" '")
        .split(" ")
        .map((word) => {
          var end = word.substring(1);
          /*if (word.includes("'")) {
            var withapos = word.lastIndexOf("'");
            var beginning = word.substring(1, withapos);
            //if (beginning.length === 1) {
            end =
              beginning +
              "'" +
              word.charAt(withapos + 1).toUpperCase() +
              word.substring(withapos + 2);
            // }
          }*/
          var resword = word.charAt(0).toUpperCase() + end;
          resword.replaceAll("Of", "of");
          resword.replaceAll("And", "and");
          resword.replaceAll("The", "the");
          //console.log(resword);["Of", "And", "The"].includes(resword); resword.toLowerCase()
          return resword; //arrayMessage(resword).join(" ");
        })
        .join(" ");
    const changePayoutInput = (e) => {
      const entry = e.target.value;
      this.setState({
        submitStripe: false,
        billing_details: {
          ...this.state.billing_details,
          [e.target.id]: !["country", "state"].includes(e.target.id)
            ? specialFormatting(
                entry,
                ["line1", "line2", "postal_code"].includes(e.target.id)
              )
            : codify(e, entry)
        }
      });
    };
    const space = " ";
    return (
      <div>
        {this.state.userFound && this.state.userFound.username}
        {!this.state.userFound ? (
          `no users found for ${this.props.pathname}`
        ) : !this.state.userFound.stripeId ? (
          "hasn't setup a payout destination yet"
        ) : this.props.auth !== undefined ? (
          <div>
            <div
              onClick={async () => {
                //return null;
                await fetch(
                  "https://king-prawn-app-j2f2s.ondigitalocean.app/list",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "Application/JSON",
                      "Access-Control-Request-Method": "POST",
                      "Access-Control-Request-Headers": [
                        "Origin",
                        "Content-Type"
                      ] //allow referer
                    },
                    body: JSON.stringify({
                      customerId: this.props.user.customerId
                    })
                  }
                )
                  .then(async (res) => await res.json())
                  .then(async (result) => {
                    if (result.status) return console.log(result);
                    if (result.error) return console.log(result);
                    if (!result.list)
                      return console.log("dev error (Cash)", result);
                    console.log(result);
                    this.setState({ list: result.list });
                  })
                  .catch(standardCatch);
              }}
            >
              List all
            </div>

            {this.state.list && (
              <div>
                payment methods:{space}
                {this.state.list.map((y) => {
                  const x = y.id;
                  const obj = this.state["paymentMethod" + x];
                  return (
                    <div key={x}>
                      {obj ? (
                        obj.card ? (
                          <div
                            style={{
                              display: "flex",
                              border:
                                this.state.chosenMethod === x
                                  ? "1px solid"
                                  : "none"
                            }}
                            onClick={() => {
                              this.setState({
                                chosenMethod: x,
                                chosenMethodIsBank: false
                              });
                            }}
                          >
                            {obj.card.brand}
                            {space}(&bull;&bull;&bull;{obj.card.last4}):
                            {obj.card.exp_month}/{obj.card.exp_year}
                            <div
                              style={{
                                border: "1px solid",
                                padding: "3px",
                                borderRadius: "3px",
                                fontSize: "10px",
                                width: "max-content"
                              }}
                            >
                              2.9% + $0.30
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              border:
                                this.state.chosenMethod === x
                                  ? "1px solid"
                                  : "none"
                            }}
                            onClick={() => {
                              this.setState({
                                chosenMethod: x,
                                chosenMethodIsBank: true
                              });
                            }}
                          >
                            {obj.us_bank_account.bank_name}
                            {space}(&bull;&bull;&bull;
                            {obj.us_bank_account.last4}
                            ):{obj.us_bank_account.account_type}
                            <div
                              style={{
                                border: "1px solid",
                                padding: "3px",
                                borderRadius: "3px",
                                fontSize: "10px",
                                width: "min-content"
                              }}
                            >
                              free
                            </div>
                          </div>
                        )
                      ) : (
                        <div
                          onClick={async () => {
                            await fetch(
                              "https://king-prawn-app-j2f2s.ondigitalocean.app/info",
                              {
                                method: "POST",
                                headers: {
                                  "Access-Control-Request-Method": "POST",
                                  "Access-Control-Request-Headers": [
                                    "Origin",
                                    "Content-Type"
                                  ], //allow referer
                                  "Content-Type": "Application/JSON"
                                },
                                body: JSON.stringify({ payment_method: x })
                              }
                            ) //stripe account, not plaid access token payout yet
                              .then(async (res) => await res.json())
                              .then(async (result) => {
                                if (result.status) return console.log(result);
                                if (result.error) return console.log(result);
                                if (!result.paymentMethod)
                                  return console.log(
                                    "dev error (Cash)",
                                    result
                                  );
                                console.log(result.paymentMethod);
                                this.setState({
                                  ["paymentMethod" + x]: result.paymentMethod
                                });
                              })
                              .catch(standardCatch);
                          }}
                        >
                          {x}
                        </div>
                      )}
                    </div>
                  );
                })}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!this.state.chosenMethod)
                      return window.alert("you must select a payment method");
                    await fetch(
                      "https://king-prawn-app-j2f2s.ondigitalocean.app/transfer",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "Application/JSON",
                          "Access-Control-Request-Method": "POST",
                          "Access-Control-Request-Headers": [
                            "Origin",
                            "Content-Type"
                          ] //allow referer
                        },
                        body: JSON.stringify({
                          payment_method: this.state.chosenMethod,
                          customerId: this.props.user.customerId,
                          total: this.state.total * 100,
                          fee: this.state.chosenMethodIsBank
                            ? 0
                            : this.state.total * 100 * 0.029 + 0.3,
                          stripeId: this.state.userFound.stripeId
                        })
                      }
                    )
                      .then(async (res) => await res.json())
                      .then(async (result) => {
                        if (result.status) return console.log(result);
                        if (result.error) return console.log(result);
                        if (!result.paymentIntent)
                          return console.log("dev error (Cash)", result);
                        window.alert(
                          "you've paid " +
                            this.state.total +
                            " to " +
                            this.state.userFound.username
                        );
                        //window.location.reload();
                        this.setState({ total: 0 });
                      })
                      .catch(standardCatch);
                  }}
                >
                  <input
                    required={true}
                    placeholder="amount to send"
                    //type="number"
                    value={this.state.total}
                    onChange={(e) =>
                      this.setState({
                        total: e.target.value
                      })
                    }
                    style={{
                      display: "flex",
                      position: "relative",
                      borderBottom: "1px white solid",
                      border: "none",
                      height: "36px",
                      width: "100px",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  />
                </form>
              </div>
            )}
          </div>
        ) : this.state.paynow ? (
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                theme: "night"
              },
              clientSecret: this.state.paynow.client_secret
              //mode: "setup", //https://stripe.com/docs/js/elements_object/update#elements_update-options-mode
              //currency: "usd"
              //paymentMethodTypes
            }}
          >
            <ElementsConsumer>
              {(props) => {
                const { stripe, elements } = props;
                this.state.stripe !== stripe &&
                  this.setState({
                    stripe,
                    elements
                  });
                console.log(this.state.paynow.client_secret);
                return (
                  stripe &&
                  (() => {
                    return (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (!stripe || !elements) return null;

                          elements.submit(); /*
                          var cardElement = elements.getElement("card");
                          const cardResult = await stripe.createToken(
                            cardElement
                          );

                          const { billing_details } = this.state;
                          const address = Object.keys(billing_details)
                            .map((x) => {
                              //console.log(remaining, event.value.address[next]);
                              return billing_details[x]
                                ? {
                                    [x]: billing_details[x]
                                  }
                                : "";
                            })
                            .filter((x) => x !== "")
                            .reduce(function (result, current) {
                              return Object.assign(result, current);
                            }, {});
                          const personal = {
                            address,
                            phone:
                              this.props.auth !== undefined &&
                              this.props.auth.phoneNumber
                                ? this.props.auth.phoneNumber
                                : "",
                            name:
                              billing_details.first +
                              billing_details.middle +
                              billing_details.last,
                            email:
                              this.props.auth !== undefined &&
                              this.props.auth.email
                                ? this.props.auth.email
                                : ""
                          };
                          await fetch("https://vault-co.in/paynow", {
                            method: "POST",
                            headers: {
                              "Access-Control-Request-Method": "POST",
                              "Access-Control-Request-Headers": [
                                "Origin",
                                "Content-Type"
                              ], //allow referer
                              "Content-Type": "Application/JSON"
                            },
                            body: JSON.stringify({
                              card: {
                                payment_token: cardResult.token.id
                              },
                              storeId: this.state.userFound.stripeId, // "acct_1NAchIGbvxLpUMRX",
                              type:
                                this.state.payoutType === "bank"
                                  ? "bank_account"
                                  : "card",
                              //paymentMethod: x.id,
                              //customerId: user[`customer${sht}Id`],
                              //storeId: this.state.chosenRecipient[`stripe83Id`],
                              currency: "usd",
                              total: this.state.amount * 100,
                              //...bankcard
                              ...personal
                            })
                          }) //stripe account, not plaid access token payout yet
                            .then(async (res) => await res.json())
                            .then(async (result) => {
                              if (result.status) return console.log(result);
                              if (result.error) return console.log(result);
                              const clientSecret = result.charge.client_secret;
                              if (!clientSecret)
                                return console.log(`dev error`, result);
                              const { error } = await stripe.confirmPayment({
                                clientSecret,
                                //`Elements` instance that was used to create the Payment Element
                                elements,
                                confirmParams: {
                                  return_url: `https://${window.location.hostname}/thanks`
                                }
                              });
                              if (error) return console.log(error);
                              window.alert(
                                "You've paid " + this.state.amount + " to "
                              );
                            });*/
                          /*const cardResult = await stripe.tokens.create({
                    card: {
                      number: "4242424242424242",
                      exp_month: 5,
                      exp_year: 2024,
                      cvc: "314"
                    }
                  });
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <input
                            required={true}
                            placeholder="amount to send"
                            //type="number"
                            value={this.state.amount}
                            onChange={(e) =>
                              this.setState({
                                amount: e.target.value
                              })
                            }
                            style={{
                              display: "flex",
                              position: "relative",
                              borderBottom: "1px white solid",
                              border: "none",
                              height: "36px",
                              width: "100px",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          />
                          <button type="submit">Pay Now</button>
                        </div>*/
                          /*const result = await stripe.confirmPayment({
                            //`Elements` instance that was used to create the Payment Element
                            elements,
                            confirmParams: {
                              return_url: `https://${window.location.hostname}/thanks`
                            }
                          });

                          if (result.error) {
                            // Show error to your customer (for example, payment details incomplete)
                            console.log(result.error.message);
                          } else {
                            window.alert(
                              "You've paid " + this.state.amount + " to "
                            );
                            // Your customer will be redirected to your `return_url`. For some payment
                            // methods like iDEAL, your customer will be redirected to an intermediate
                            // site first to authorize the payment, then redirected to the `return_url`.
                          }*/
                          var cardElement = elements.getElement("card");
                          stripe
                            .confirmCardPayment(
                              this.state.paynow.client_secret,
                              {
                                payment_method: { card: cardElement }
                              }
                            )
                            .then(function (result) {
                              if (result.error) {
                                console.log(result);
                              } else {
                                window.alert("You've paid ");
                              }
                            });
                        }}
                      >
                        <CardElement />
                        {/*<PaymentElement />*/}
                        <button>Submit</button>
                      </form>
                    );
                  })()
                );
              }}
            </ElementsConsumer>
          </Elements>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              const { billing_details } = this.state;
              const address = Object.keys(billing_details)
                .map((x) => {
                  //console.log(remaining, event.value.address[next]);
                  return billing_details[x]
                    ? {
                        [x]: billing_details[x]
                      }
                    : "";
                })
                .filter((x) => x !== "")
                .reduce(function (result, current) {
                  return Object.assign(result, current);
                }, {});
              const personal = {
                address,
                phone:
                  this.props.auth !== undefined && this.props.auth.phoneNumber
                    ? this.props.auth.phoneNumber
                    : "",
                name: this.state.first + this.state.middle + this.state.last,
                email:
                  this.props.auth !== undefined && this.props.auth.email
                    ? this.props.auth.email
                    : ""
              };
              // Handle result.error or result.paymentMethod

              /*await stripe
                .createPaymentMethod({
                  type: "card",
                  card: cardElement,
                  billing_details
                })
                .then(async (result) => {
              if (result.error) return console.log(result);*/
              await fetch("https://vault-co.in/payintent", {
                method: "POST",
                headers: {
                  "Access-Control-Request-Method": "POST",
                  "Access-Control-Request-Headers": ["Origin", "Content-Type"], //allow referer
                  "Content-Type": "Application/JSON"
                },
                body: JSON.stringify({
                  //payment_method: result.paymentMethod,
                  return_url: `https://${window.location.hostname}/thanks`,
                  storeId: this.state.userFound.stripeId, // "acct_1NAchIGbvxLpUMRX",
                  type:
                    this.state.payoutType === "bank" ? "bank_account" : "card",
                  //paymentMethod: x.id,
                  //customerId: user[`customer${sht}Id`],
                  //storeId: this.state.chosenRecipient[`stripe83Id`],
                  fee: this.state.amount * 100 * 0.029 + 0.3,
                  currency: "usd",
                  total: this.state.amount * 100,
                  //...bankcard
                  ...personal
                })
              }) //stripe account, not plaid access token payout yet
                .then(async (res) => await res.json())
                .then(async (result) => {
                  if (result.status) return console.log(result);
                  if (result.error) return console.log(result);
                  this.setState({ paynow: result.intent }); //client_secret
                });
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                required={true}
                placeholder="amount to send"
                //type="number"
                value={this.state.amount}
                onChange={(e) =>
                  this.setState({
                    amount: e.target.value
                  })
                }
                style={{
                  display: "flex",
                  position: "relative",
                  borderBottom: "1px white solid",
                  border: "none",
                  height: "36px",
                  width: "100px",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              />
            </div>
            <div
              style={{
                width: "100%"
              }}
            >
              <input
                required={true}
                placeholder="First"
                value={this.state.first}
                onChange={(e) => {
                  this.setState({
                    first: e.target.value
                  });
                }}
                style={{ width: "33%" }}
              />
              <input
                placeholder="Middle"
                value={this.state.middle}
                onChange={(e) => {
                  this.setState({
                    middle: e.target.value
                  });
                }}
                style={{ width: "33%" }}
              />
              <input
                required={true}
                placeholder="Last"
                value={this.state.last}
                onChange={(e) => {
                  this.setState({
                    last: e.target.value
                  });
                }}
                style={{ width: "33%" }}
              />
            </div>
            <table>
              <thead></thead>
              <tbody>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      required={true}
                      value={this.state.billing_details["line1"]}
                      onChange={changePayoutInput}
                      id="line1"
                      placeholder="address"
                    />
                  </td>
                </tr>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      value={this.state.billing_details["line2"]}
                      onChange={changePayoutInput}
                      id="line2"
                      placeholder="p.o. box or unit number"
                    />
                  </td>
                </tr>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      required={true}
                      value={this.state.billing_details["city"]}
                      onChange={changePayoutInput}
                      id="city"
                      placeholder="city"
                    />
                  </td>
                </tr>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      //maxLength={2}
                      //https://stripe.com/docs/tax/customer-locations#us-postal-codes
                      required={true}
                      value={this.state.billing_details["state"]}
                      onChange={changePayoutInput}
                      id="state"
                      placeholder="state"
                    />
                  </td>
                </tr>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      maxLength={5}
                      required={true}
                      value={this.state.billing_details["postal_code"]}
                      onChange={changePayoutInput}
                      id="postal_code"
                      placeholder="ZIP"
                    />
                  </td>
                </tr>
                <tr
                  style={{
                    width: "calc(100% - 4px)",
                    display: "flex"
                  }}
                >
                  <td style={{ width: "100%" }}>
                    <input
                      style={inputStyle}
                      //maxLength={2}
                      required={true}
                      value={this.state.billing_details["country"]}
                      onChange={changePayoutInput}
                      id="country"
                      placeholder="Country"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="submit">Pay Now</button>
          </form>
        )}
      </div>
    );
  }
}
export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.gui = React.createRef();
    this.pa = React.createRef();
    this.ra = React.createRef();
  }
  render() {
    const hiddenUserData = (ath) => {
        //console.log("hiddenuserdata");
        onSnapshot(
          doc(firestore, "userDatas", ath.uid),
          (doc) => {
            var userDatas = undefined;
            if (doc.exists()) {
              var u = this.state.user;
              userDatas = doc.data(); //{...,doc.id}

              //delete u.defaultEmail;
              const user = {
                ...u,
                ...userDatas,
                userDatas: true
              };
              this.setState(
                {
                  user,
                  userDatas
                }
                //() => this.getEntities(meAuth)
              );
            } else
              console.log(
                `user: ${
                  this.state.user.username //+ " " + ath.uid
                }, has no hidden data`
              );
          },
          (err) => console.log(err.message)
        );
      },
      logoutofapp = (yes) => {
        var answer = yes || window.confirm("Are you sure you want to log out?");
        if (!answer) {
          //this.ra.current.click();
          return this.gui.current.click();
        } //ra;//null;
        signOut(getAuth())
          .then(async () => {
            console.log("logged out");
            await setPersistence(getAuth(), browserSessionPersistence);
            this.setState({
              user: undefined,
              auth: undefined
            });
            this.ra.current.click();
          })
          .catch((err) => {
            console.log(err);
          });
      };
    const meAuth =
      window.meAuth &&
      window.meAuth.constructor === Object &&
      Object.keys(window.meAuth).length > 0
        ? window.meAuth
        : undefined;
    const space = " ";
    return (
      <div>
        {this.props.pathname !== "/" ? (
          <User
            auth={meAuth}
            pathname={this.props.pathname}
            user={this.state.user}
          />
        ) : (
          <div style={{ maxWidth: "500px" }}>
            Salt Donation collects your name, username, address, and banking
            credentials to{space}
            <span
              style={{
                textDecoration: "underline"
              }}
            >
              generate your own donation page
            </span>
            . (help: sayists@icloud.com)
            {meAuth === undefined ? (
              !this.state.login ? (
                <div
                  style={{
                    fontSize: "30px",
                    fontFamily: "'Pacifico', cursive",
                    padding: "25px 0px",
                    textAlign: "center",
                    width: "100%",
                    backgroundColor: "darkblue"
                  }}
                >
                  <div style={{ color: "white" }}>Salt</div>
                  <button
                    onClick={() => this.setState({ login: !this.state.login })}
                  >
                    login / signup
                  </button>
                </div>
              ) : (
                <Sudo
                  ref={{ current: {} }}
                  forbiddenUsernames={[
                    "event",
                    "events",
                    "club",
                    "clubs",
                    "shop",
                    "shops",
                    "restaurant",
                    "restaurants",
                    "service",
                    "services",
                    "dept",
                    "department",
                    "departments",
                    "classes",
                    "class",
                    "oldclass",
                    "oldclasses",
                    "job",
                    "jobs",
                    "housing",
                    "oldhome",
                    "page",
                    "pages",
                    "venue",
                    "venues",
                    "forum",
                    "posts",
                    "post",
                    "oldelection",
                    "elections",
                    "election",
                    "case",
                    "cases",
                    "oldcase",
                    "oldcases",
                    "budget",
                    "budgets",
                    "oldbudget",
                    "oldbudgets",
                    "ordinance",
                    "ordinances",
                    "new",
                    "news",
                    "login",
                    "logins",
                    "doc",
                    "docs",
                    "private",
                    "privacy",
                    "legal",
                    "terms",
                    "law",
                    "laws",
                    "bill",
                    "bills"
                  ]}
                  phoneNumberCollection={"numbers"}
                  width={this.props.width}
                  rooturi={"https://thumbprint.app/"} //comment out to use click
                  homeuri={"https://thumbprint.app"} // emulateRoot onroot instead
                  logoutofapp={logoutofapp}
                  auth={meAuth}
                  lastWidth={this.props.lastWidth}
                  availableHeight={this.props.appHeight}
                  backgroundColor={null} //transparent
                  position={"relative"}
                  supportemail={"nick@thumbprint.us"}
                  welcomeName={"Thumbprint.us - Social calendar"}
                  onroot={true}
                  emulateRoot={(e) => this.setState(e)}
                  getUserInfo={() => this.gui.current.click()}
                  setAuth={(auth) =>
                    this.setState(auth, () => this.pa.current.click())
                  }
                  //
                  meAuth={window.meAuth}
                  user={this.state.user}
                  pathname={this.props.pathname}
                  navigate={this.props.navigate}
                  useTopComment={null}
                  memberMessage=""
                  subTop=""
                  useTitle={<span></span>}
                  useCan={null} //trash
                  useCanComment={null}
                  root={(a) => this.state.onroot && <div></div>}
                  rootArguments={[
                    {
                      current: {}
                    }
                  ]}
                  subRoot=""
                  //emulateRoot={() => this.props.navigate("/")}
                  home={!this.state.onroot && <div></div>} //Are drug gangs not pharmacists because they have no shop nor employees?
                  //Do employees of regular businesses with diverse customers have to report gifted sweat up to $15,000 per year?
                />
              )
            ) : (
              <button
                onClick={() => logoutofapp()}
                style={{
                  wordWrap: "unset",
                  width: "max-content",
                  border: "1px solid",
                  borderRadius: "2px",
                  padding: "3px 6px"
                }}
              >
                logout of app (
                {this.state.user !== undefined && this.state.user.username})
              </button>
            )}
            {meAuth === undefined ? (
              <div>
                Sign in to transact without 2.9% + $.30 fees or visit a /slug to
                donate. Try it out!{" "}
                <a href="https://salt.net.co/test3">Donate to the developer</a>
              </div>
            ) : (
              <div>
                <Bank
                  getUserInfo={() => this.gui.current.click()}
                  user={this.state.user}
                  auth={meAuth}
                  navigate={this.props.navigate}
                  pathname={this.props.pathname}
                />
              </div>
            )}
          </div>
        )}
        <PromptAuth
          ref={{
            current: {
              pa: this.pa,
              gui: this.gui,
              ra: this.ra
            }
          }}
          onPromptToLogin={() => {}} //this.props.history.push("/login")}
          verbose={false}
          onStart={() => {
            //if (window.meAuth !== undefined) return this.props.navigate("/");
            window.alert("loading authentication...");
          }}
          onEnd={() => {
            //window.alert("loading authentication...");
          }}
          windowKey={"meAuth"} //window.meAuth
          hydrateUser={(me, reload, isStored) => {
            if (me && me.constructor === Object) {
              if (isStored) return console.log("isStored: ", me); //all but denied

              if (me.isAnonymous) return console.log("anonymous: ", me);

              if (!me.uid)
                return this.setState({
                  user: undefined,
                  auth: undefined
                });
              //console.log("me", me);
              //this.pa.current.click();

              onSnapshot(
                doc(firestore, "users", me.uid),
                (doc) =>
                  doc.exists() &&
                  this.setState(
                    {
                      user: { ...doc.data(), id: doc.id },
                      loaded: true
                    },
                    () => hiddenUserData(me)
                  )
              );
              return reload && window.location.reload();
            }
            console.log("me", me);
          }} //detract alternative, kurt carface bank
          onFinish={() => {}}
          meAuth={window.meAuth === undefined ? null : window.meAuth}
        />
      </div>
    );
  }
}

