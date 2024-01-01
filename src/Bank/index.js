import React from "react";
import firebase from ".././init-firebase";
import {
  Elements,
  ElementsConsumer,
  PaymentElement
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import {
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  //
  PhoneAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  sendEmailVerification,
  RecaptchaVerifier
} from "firebase/auth";
import STRIPE_ADDRESS from "./STRIPE_ADDRESS";
import { countries, states } from "./countries";
import { specialFormatting, standardCatch } from "../Sudo";

const firestore = getFirestore(firebase);
const stripePromise = loadStripe("pk_live_QbdOMSMchlB2Bw8JeKVFAlWp"); //pk
class Bank extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      payoutType: "setup",
      billing_details: {
        city: "",
        line1: "",
        line2: "",
        state: "",
        postal_code: "",
        country: "US"
      },
      number: "4242424242424242",
      expiry: "12/34",
      cvc: "000",
      account_holder_type: "individual",
      account_number: "000123456789",
      routing_number: "110000000",
      savings: "checking",
      first: "",
      middle: "",
      last: "",
      list: []
    };
    this.phoneAuthProvider = new PhoneAuthProvider(getAuth());
  }
  componentDidUpdate = async (prevProps) => {
    if (
      this.props.pathname !== prevProps.pathname ||
      this.state.stripe !== this.state.lastStripe
    ) {
      this.setState({ lastStripe: this.state.stripe });
      this.findURL();
    }
  };
  componentDidMount = () => {
    this.findURL();
  };
  findURL = async () => {
    if (this.props.auth === undefined) return null;
    const url = new URL(window.location.href);
    const stripeId = url.searchParams.get("stripe");
    const mcc = url.searchParams.get("mcc");
    const redo = url.searchParams.get("redo");
    //console.log(url);
    if (stripeId && mcc) {
      if (!redo) {
        //return null;
        //customer = `customer${digits}Id`,
        //cardholder = `cardholder${digits}Id`;
        //kv[customer] = store.customerId;
        //kv[cardholder] = store.cardholderId;
        //kv.invoice_prefix = store.invoice_prefix;
        //return kv;

        //RESSEND(res, { statusCode, statusText, error: "before getDoc" });
        getDoc(
          doc(firestore, "userDatas", this.props.auth.uid)
        ) /*.then((d) => {return { keyvalue, exists: d.exists() }; })*/
          .then(
            //{ keyvalue, exists }
            (d) => {
              (d.exists() ? updateDoc : setDoc)(
                doc(firestore, "userDatas", this.props.auth.uid),
                {
                  [`stripeLink`]: deleteField()
                }
              ) //RESSEND(res, { statusText: "successful accountLink"});
                .then(() => {
                  updateDoc(doc(firestore, "users", this.props.auth.uid), {
                    [`stripeId`]: stripeId
                  });
                  this.props.navigate("/");
                });
            }
          );
      } else {
        getDoc(
          doc(firestore, "userDatas", this.props.auth.uid)
        ) /*.then((d) => {return { keyvalue, exists: d.exists() }; })*/
          .then(
            //{ keyvalue, exists }
            (d) => {
              (d.exists() ? updateDoc : setDoc)(
                doc(firestore, "userDatas", this.props.auth.uid),
                {
                  [`stripeLink`]: deleteField()
                }
              ) //RESSEND(res, { statusText: "successful accountLink"});
                .then(async () => {
                  updateDoc(doc(firestore, "users", this.props.auth.uid), {
                    [`stripeId`]: deleteField()
                  });
                  this.deleteThese([stripeId]);
                  this.props.navigate("/");
                });
            }
          );
      }
    }
    const clientSec = new URLSearchParams(window.location.search).get(
      "setup_intent_client_secret"
    );
    if (clientSec) {
      console.log("clientSec", clientSec);
      this.setState({
        payoutType: "Bank",
        clientSec
      });
      false &&
        (await fetch(
          "https://king-prawn-app-j2f2s.ondigitalocean.app/confirm",
          {
            method: "POST",
            headers: {
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": ["Origin", "Content-Type"], //allow referer
              "Content-Type": "Application/JSON"
            },
            body: JSON.stringify({
              seti: clientSec
            })
          }
        ) //stripe account, not plaid access token payout yet
          .then(async (res) => await res.json())
          .then(async (result) => {
            if (result.status) return console.log(result);
            if (result.error) return console.log(result);
            if (!result.setupIntent)
              return console.log("dev error (Cash)", result);
            console.log(result);
          })
          .catch(standardCatch));
    }
    // Retrieve the SetupIntent
    clientSec &&
      this.state.stripe &&
      this.state.stripe
        .retrieveSetupIntent(clientSec)
        .then(async ({ setupIntent }) => {
          if (setupIntent.status)
            await fetch(
              "https://king-prawn-app-j2f2s.ondigitalocean.app/attach",
              {
                method: "POST",
                headers: {
                  "Content-Type": "Application/JSON",
                  "Access-Control-Request-Method": "POST",
                  "Access-Control-Request-Headers": ["Origin", "Content-Type"] //allow referer
                },
                body: JSON.stringify({
                  payment_method: setupIntent.payment_method,
                  customerId: this.props.user.customerId
                })
              }
            )
              .then(async (res) => await res.json())
              .then(async (result) => {
                if (result.status) return console.log(result);
                if (result.error) return console.log(result);
                if (!result.paymentMethod)
                  return console.log("dev error (Cash)", result);

                updateDoc(doc(firestore, "userDatas", this.props.auth.uid), {
                  paymentMethods: arrayUnion(setupIntent.payment_method)
                });
                this.props.navigate("/");
                //window.location.reload();
              })
              .catch(standardCatch);
          // Inspect the SetupIntent `status` to indicate the status of the payment
          // to your customer.
          //
          // Some payment methods will [immediately succeed or fail][0] upon
          // confirmation, while others will first enter a `processing` state.
          //
          // [0]: https://stripe.com/docs/payments/payment-methods#payment-notification
          switch (setupIntent.status) {
            default:
              break;
            case "succeeded":
              console.log(
                "Success! Your payment method has been saved.",
                setupIntent
              );

              //

              this.setState({
                payoutType: "setup"
                //confirmBank: "bank"
              });
              break;

            case "processing":
              console.log(
                "Processing payment details. We'll update you when processing is complete."
              );
              break;

            case "requires_payment_method":
              // Redirect your user back to your payment page to attempt collecting
              // payment again
              console.log(
                "Failed to process payment details. Please try another payment method."
              );
              break;
          }
          this.props.navigate("/");
        });
  };
  addEmail = async (User) =>
    await updateEmail(User, this.props.openEmail)
      .then(async () => {
        const callbackUser = async (email) => {
          window.alert(
            "email updated to " +
              email +
              ". Click the link (and login again) to confirm it works."
          );
          //if (!this.state.humanCodeCredential) {
          console.log(
            "added email " + email + ". Able to verify by link in email."
          ); //upsert (update, assert/set)
          //return this.FIREBASE_email.current.click(); //this.handleUpdateEmail(email);
          //await emailMulti(email); //confirm
          this.props.logoutofapp();
          //var gotAuth = getAuth().currentUser;
          //Cannot destructure property 'auth' of 'user' as it is null.
        };
        return await sendEmailVerification(User)
          .then(callbackUser(this.props.openEmail))
          .catch((err) => console.log("sendEmailVerification ", err.message));
      }) //({ user } = (re) => re) =>
      .catch((err) => console.log(err.message));

  promptCode = async () =>
    await this.phoneAuthProvider
      .verifyPhoneNumber(this.props.auth.phoneNumber, window.recaptchaVerifier) //recaptchaWidgetId
      .then(async (verificationId) => {
        const credential = PhoneAuthProvider.credential(
          verificationId,
          window.prompt("Enter your code")
        );
        console.log("id, credential: ", verificationId, credential);
        //return emailMulti(email); //confirm getAuth().currentUser
        //getAuth().currentUser.getIdToken is not a function
        var User = this.props.auth;
        if (
          getAuth().currentUser &&
          getAuth().currentUser.getIdToken &&
          getAuth().currentUser.getIdToken instanceof Function
        ) {
          User = getAuth().currentUser;
        } //else User.getIdToken = () => { return; };
        console.log("User ", User);

        return await reauthenticateWithCredential(
          User,
          credential //this.emailAuthProvider.credentialFromResult(res)
        ).then(async () => await this.addEmail(User));
      })
      .catch(standardCatch);
  responseCallback = () => {
    console.log("multi");
    this.promptCode();
    //window.recaptchaId=""
  };
  mountRecaptcha = () => {
    const loggedIn = this.props.auth !== undefined;
    window.recaptchaVerifier = new RecaptchaVerifier(
      this.FIREBASE_PHONE_recaptcha.current,
      {
        size: "normal", //callback:()=>true,getResponse : await render()
        callback: (res) => {
          const title = loggedIn ? "multi-" : "main ";
          console.log(`${title}authentication recaptcha response: `, res);
          const recaptchaResponse = window.grecaptcha.getResponse(
            window.recaptchaId
          );
          console.log("verified RecaptchaVerifier: ", recaptchaResponse);
          this.responseCallback();
          return res;
        },
        "expired-callback": (err) => {
          //window.recaptchaVerifier.clear();
          window.recaptchaId = "";
          loggedIn &&
            this.setState({
              sentCode: false
            });
          console.log(err.message);
          return err;
        }
      },
      getAuth()
    );
    let script = require("scriptjs");

    !this.isMountCanceled &&
      script("https://www.google.com/recaptcha/api.js", "explicit", () =>
        this.setState({ loadedRecaptcha: true }, async () => {
          if (!this.isMountCanceled)
            await window.recaptchaVerifier
              .render()
              .then((id) => {
                this.setState({ recaptchaId: id });
              }) //onload=onloadCallback&render=explicit
              .catch(standardCatch);
        })
      );
  };
  mountRecaptcha = () => {
    console.log("mount recaptcha multi");
    !this.isMountCanceled &&
      window.recaptchaVerifier
        .render()
        .then((id) => (window.recaptchaId = id)) //onload=onloadCallback&render=explicit
        .catch(standardCatch);
  };
  componentWillUnmount = () => {
    this.isMountCanceled = true;
  };
  deleteThese = async (deleteThese = [], sinkThese = []) => {
    await fetch("https://king-prawn-app-j2f2s.ondigitalocean.app/delete", {
      method: "POST",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": ["Origin", "Content-Type"], //allow referer
        "Content-Type": "Application/JSON"
      },
      body: JSON.stringify({
        sinkThese,
        deleteThese
      })
    }) //stripe account, not plaid access token payout yet
      .then(async (res) => await res.json())
      .then(async (result) => {
        if (result.status) return console.log(result);
        if (result.error) return console.log(result);
        if (!result.data) return console.log("dev error (Cash)", result);
        console.log(result.data);
      })
      .catch(standardCatch);
  };
  render() {
    const paymentItems = this.state;
    const { user } = this.props;
    const textu = (e, name, exp) => {
      const value = e.target.value;
      this.setState({
        [name]:
          value +
          (exp ? value.substring(0, 2) + "/" + value.substring(2, 4) : "")
      });
    };
    const trust = {
      mcc: "8398",
      account: "Charity",
      description: "A simple donation page."
    };
    const purchase = async (x, custom) => {
      console.log("purchase");
      //customerResult,
      /*var stripeAccount = "stripe" + trust.account;
        const { first, last, auth } = this.props,
          custom = null; //standard, or express
        if (this.props.user[stripeAccount]) {
          const done = JSON.stringify({
            [trust.account]: this.props.user[stripeAccount]
          }); //Why do synchronous intrinsic JSON functions need a scope declaration?
          return r(done);
        }*/
      const payouts = {
          schedule: {
            interval: "manual" //400 invalid_request_error
            //Cannot provide a delay_days when interval is manual. delay_days is always the minimum for manual payouts.
            //delay_days: "minimum" //"doesn't apply", "2 day rolling basis (US)"
          },
          statement_descriptor: "Salt.net.co/" + this.props.user.username
        },
        pad = (x) => (String(x).length === 1 ? "0" + String(x) : x),
        today = new Date(),
        now =
          today.getUTCFullYear() +
          "-" +
          pad(today.getUTCMonth() + 1) +
          "-" +
          pad(today.getUTCDate()),
        ip = "100.35.136.125", // IPv4,
        user_agent = this.state.user_agent,
        date = String(Math.floor(new Date(now).getTime() / 1000)); //new Date(now).getTime() / 1000, // - 14400, //
      console.log(now);
      // return console.log("name", name);
      const first =
          paymentItems.first !== ""
            ? paymentItems.first
            : user.first
            ? user.first
            : this.state.first,
        last =
          paymentItems.last !== ""
            ? paymentItems.last
            : user.last
            ? user.last
            : this.state.last,
        name = first + " " + last,
        companyName = `${x.account} ` + name,
        ownership_declaration = {
          date,
          ip, //IPv4
          user_agent
        };
      var newAccount = {
        //tos_shown_and_accepted: true,
        //Are express, standard or custom Stripe Connect account addresses tokenizable?
        //How are React developers supposed to create tokenized Stripe Standard accounts if the tos_shown_and_accepted field is required?

        //delete this in firestore + stripe dashboard,
        //to retry business_profile.{} (test mode; any "company" account type)

        business_profile: {
          mcc: trust.mcc, //"7276", //"8931", value === "POI Funding Transactions"
          name: companyName,
          //Stripe "custom and express" only
          product_description: trust.description,
          support_email: this.props.auth.email,
          support_phone: this.props.auth.phoneNumber,
          support_url: `https://salt.net.co/${this.props.user.username}`,
          url: `https://salt.net.co/${this.props.user.username}`
        }, //support, mcc, url
        settings: {
          /*payouts_enabled: true,
            controller: {
              type: "application",
              is_controller: true
            },*/ //https://stripe.com/docs/connect/platform-controls-for-standard-accounts
          //why are the above on the doc-spec account object but not "create" iteration
          /*card_issuing: {
            tos_acceptance: {
              user_agent,
              date,
              ip
            }
          },*/ //"custom"
          payouts,
          //https://stripe.com/docs/connect/statement-descriptors
          payments: {
            statement_descriptor: x.mcc + " " + name.substring(0, 17) //"Vau.money Decanter" //PRE-TAX TRUSTEE DECANTER
          }
        },
        /*capabilities: {
          card_payments: {
            requested: true
          },
          transfers: {
            requested: true
          },
          card_issuing: {
            requested: true
          },
          us_bank_account_ach_payments: {
            requested: true
          }
        },*/
        business_type: "company", //email required?
        default_currency: "usd"
        /*tos_acceptance: {
          ...ownership_declaration,
          service_agreement: "full"
        }*/
      };
      //var custom = true;
      if (!custom) {
        delete newAccount.tos_acceptance;
        delete newAccount.capabilities; //.card_issuing;
        //delete newAccount.capabilities.us_bank_account_ach_payments;
        delete newAccount.settings.card_issuing;
      }
      //accountResult = await stripe.createToken("account", newAccount);
      //https://stripe.com/docs/api/persons/create
      //return console.log(first, last);

      await fetch("https://king-prawn-app-j2f2s.ondigitalocean.app/purchase", {
        method: "POST",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": ["Origin", "Content-Type"], //allow referer
          "Content-Type": "Application/JSON"
        },
        body: JSON.stringify({
          type: custom ? "custom" : "standard", //standard
          country: "US",
          uid: this.props.auth.uid,
          newAccount: newAccount,
          first,
          last
        })
      }) //stripe account, not plaid access token payout yet
        .then(async (res) => await res.json())
        .then(async (result) => {
          if (result.status) return console.log(result);
          if (result.error) return console.log(result);
          if (!result.account) return console.log("dev error (Cash)", result);
          //If there is not (accountLink), the new stripe (account.id) stripeId is caught here

          const { address: addr } = this.state,
            address = Object.keys(paymentItems.billing_details).every(
              (key) =>
                paymentItems.billing_details[key] !== "" ||
                ["line2"].includes(key)
            )
              ? paymentItems.billing_details
              : addr;
          //if (!this.props.user.stripeId) {
          const personResult = await this.state.stripe.createToken("person", {
              relationship: { owner: true },
              first_name: first,

              last_name: last,
              email: this.props.auth.email,
              phone: this.props.auth.phoneNumber,
              address
            }),
            companyResult = await this.state.stripe.createToken("account", {
              company: {
                address,
                name: companyName, //this.state.billing_details.name,
                structure: "unincorporated_association", //trust // "sole_proprietorship",
                phone: this.props.auth.phoneNumber, //owners are provided after the account.person
                ownership_declaration,
                owners_provided: true
              }
            });

          await fetch(
            "https://king-prawn-app-j2f2s.ondigitalocean.app/beneficiary",
            {
              method: "POST",
              headers: {
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": ["Origin", "Content-Type"], //allow referer
                "Content-Type": "Application/JSON"
              },
              body: JSON.stringify({
                type: custom ? "custom" : "standard", //standard
                mcc: trust.mcc,
                accountId: result.account.id,
                person: {
                  account_token: personResult.token.id
                },
                companyAccount: {
                  account_token: companyResult.token.id
                }
              })
            }
          ) //stripe account, not plaid access token payout yet
            .then(async (res) => await res.json())
            .then((result) => {
              if (result.status) return console.log(result);
              if (result.error) return console.log(result);
              if (!result.account)
                return console.log("dev error (Cash)", result);
              var keyvalue = {};

              getDoc(
                doc(firestore, "userDatas", this.props.auth.uid)
              ) /*.then((d) => {return { keyvalue, exists: d.exists() }; })*/
                .then(
                  //{ keyvalue, exists }
                  (d) => {
                    (d.exists() ? updateDoc : setDoc)(
                      doc(firestore, "userDatas", this.props.auth.uid),
                      {
                        address,
                        first,
                        last,
                        /*
                          don't add id by return_url because it might notbe finished
                          [`stripe${shorter(
                            trust.mcc
                          )}Id`]: result.account.id,
                          delete link upon refresh account id search query get("stripeId")
                          */
                        stripeLink: result.account.accountLink.url,
                        personId: result.account.person.id
                      }
                    ) //RESSEND(res, { statusText: "successful accountLink"});
                      .then(() => {
                        //8398
                        //6540
                        const answer = window.confirm(
                          "Want to go along to submit details instead of passing " +
                            "them by for later and just hang out instead?"
                        );
                        if (answer)
                          window.location.href = result.account.accountLink.url;
                      });
                  }
                );
            })
            .catch((x) => standardCatch(x, "/beneficiary"));
        })
        .catch((x) => standardCatch(x, "/purchase"));
    };
    const makeAccount = async () => {
      /**
       * delete accounts and customers, if any
       */
      const deleteThese = [],
        sinkThese = [];
      if (deleteThese.length !== 0 || sinkThese.length !== 0)
        return this.deleteThese(deleteThese, sinkThese);
      if (this.state.selectThisOne !== trust.mcc)
        return this.setState({ selectThisOne: trust.mcc, balance: false });

      const { address: addr } = user; //this address was
      //console.log("o address", this.state.address);
      /**
       * load userDatas private collection from firebase
       */
      if (!addr && !this.state.address) return this.props.getUserInfo();

      /**
       * a stripe account exists
       */
      if (user.stripeId && !user.stripeLink) {
        if (user.customerId) this.deleteThese([], [user.customerId]);
        /*if (user[`customer${shorter(trust.mcc)}Id`]) {
          if (!user[`cardholder${shorter(trust.mcc)}Id`])
          return console.log("dev error (no card)");

          return window.alert(
            "This is your " +
              trust.account +
              " settlement-checking account with us."
          );
          //submitBankCard();
        }*/
        /**
         * prompt cardholder, already custom-cardholder
         */
        /**
         * no issuing? proceed without stripe custom account
         */
        var issuing = false;
        if (issuing) {
          if (!this.state.stripe)
            return this.stripeemailaddress.current.click();
          const payments = true;
          purchase(trust, payments);
        }
        /*if (!addr)
          //no need emailCallback? while user[`stripeId`]&&!user[`stripeLink`]
          return this.setState({ openFormSecure: true });*/
        /**
         * make customer with private userDatas + firebase auth User info
         */
        const { address: addr, first, last } = user,
          address = Object.keys(addr)
            .map((x) => {
              //console.log(remaining, event.value.address[next]);
              return addr[x]
                ? {
                    [x]: addr[x]
                  }
                : "";
            })
            .filter((x) => x !== "")
            .reduce(function (result, current) {
              return Object.assign(result, current);
            }, {}),
          merchantSurnamePrefix =
            user.address.country +
            String(this.state.selectThisOne).substring(0, 2) +
            last.substring(0, 3).toLocaleUpperCase(),
          totalMerchantSurnames = await getDoc(
            doc(
              collection(firestore, "merchantSurnames"),
              merchantSurnamePrefix
            )
          )
            .then((dx) => {
              (dx.exists() ? updateDoc : setDoc)(
                doc(
                  collection(firestore, "merchantSurnames"),
                  merchantSurnamePrefix
                ),
                { count: increment(1) }
              );
              console.log(merchantSurnamePrefix + " set");
              return dx.exists() ? { ...dx.data(), id: dx.id }.count + 1 : 1;
            })
            .catch((err) => {
              console.log("surname update,set, or get failure: ", err.message);
              return err;
            });
        if (
          !totalMerchantSurnames ||
          totalMerchantSurnames.constructor !== Number
        )
          return window.alert(
            "dev error (no document can be made): ",
            totalMerchantSurnames
          );

        //delete edit.authorId;
        //delete edit.mcc;
        return await fetch(
          "https://king-prawn-app-j2f2s.ondigitalocean.app/customer",
          {
            method: "POST",
            headers: {
              "Content-Type": "Application/JSON",
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": ["Origin", "Content-Type"] //allow referer
            },
            body: JSON.stringify({
              customer: {
                //authorId: this.props.auth.uid,
                //mcc: trust.mcc,
                //last,
                email: this.props.auth.email,
                //address: auth.address,
                name: first + " " + last,
                phone: this.props.auth.phoneNumber,
                shipping: {
                  address,
                  name: first + " " + last,
                  phone: this.props.auth.phoneNumber
                },
                address,
                description: trust.description,
                invoice_prefix: merchantSurnamePrefix + totalMerchantSurnames
                //type: "physical"
              }
            })
          }
        )
          .then(async (res) => await res.json())
          .then(async (result) => {
            getDoc(doc(collection(firestore, "userDatas"), this.props.auth.uid))
              .then((d) => {
                //kv.invoice_prefix = store.invoice_prefix;
                (d.exists() ? updateDoc : setDoc)(
                  doc(collection(firestore, "userDatas"), this.props.auth.uid),
                  {
                    [`customerId`]: result.customer.id
                  }
                )
                  .then(() => {})
                  .catch((e) => standardCatch(e)); //plaidLink payouts account.details_submitted;
              })
              .catch((e) => standardCatch(e)); //plaidLink payouts account.details_submitted;
          });
      }
      if (!this.state.address)
        return window.alert(
          `Add your name and address first to make the ${trust.account} account.`
        );
      if (!this.state.address) return null;
      const answer = window.confirm(
        "Have you read stripe.com/legal/connect-account? Do you consent to everything you can?"
      );
      if (answer) purchase(trust); //this should be first
    };
    const codify = (e, entry) => {
      const output = (e.target.id === "country" ? countries : states).find(
        (x) => x.name.toUpperCase() === entry.toUpperCase()
      );
      return output
        ? output[e.target.id === "country" ? "alpha_2" : "abbreviation"]
        : entry;
    };
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
            : codify(e, entry).toUpperCase()
        }
      });
    };
    const inputStyle = {
      border: "0px dotted grey",
      borderRadius: "0px",
      width: "100%"
    };
    const space = " ";
    const isEmail = (email) =>
      email !== "" && email.split("@")[1] && email.split("@")[1].split(".")[1];
    const emailnew = () => {
      if (this.props.auth.email && this.props.auth.emailVerified === false)
        return this.props.getUserInfo();
      if (
        !this.props.auth.email ||
        (!this.props.auth.emailVerified && window.confirm("resend email?"))
      ) {
        if (this.props.auth.email && !this.props.auth.emailVerified)
          return window.alert("check your email: " + this.props.auth.email);
        const email = window.prompt(
          "your decanter email" +
            (this.props.auth.emailVerified
              ? this.props.auth.email
              : ` (you will enter this again while visiting the confirmation path)`)
        );
        if (!email) return null;
        if (isEmail(email)) {
          this.setState({ openEmail: email });
          console.log("email", email);
          if (!this.props.auth.email || this.props.auth.email !== email) {
            console.log("mount recaptcha");
            return this.mountRecaptcha();
          }
          return null;
        } else return window.alert(`${email} is not an email format`);
      }
    };
    return this.props.auth === undefined ? (
      "Vaults.biz industry assessment"
    ) : (
      <div>
        <div
          style={{
            display: "inline-block"
          }}
        >
          <div
            onClick={async () => {
              /*if (!this.state.account)
          return this.setState({ openLinkToStripe: true },()=>{
            
          });*/
              const { email } = this.props.auth;
              console.log(this.props.auth);
              if (
                !email ||
                !this.props.auth.emailVerified ||
                email !== this.state.openEmail
              )
                return emailnew();

              if (this.props.auth.emailAuth) return null; //emailCallback();

              fetchSignInMethodsForEmail(getAuth(), email)
                .then((signInMethods) => {
                  if (
                    signInMethods.indexOf(
                      EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD
                    ) > -1
                  )
                    return null; //emailCallback();

                  const canSignLinkEmail = isSignInWithEmailLink(
                    getAuth(),
                    window.location.href
                  ); //console.log("getAuth() a.k.a. auth ", getAuth());
                  console.log(
                    `can${canSignLinkEmail ? "" : "'t"} sign in with ` + email
                  );
                  if (canSignLinkEmail)
                    return signInWithEmailLink(
                      getAuth(),
                      email,
                      window.location.href
                    )
                      .then(() => {
                        window.alert(email + " added!");
                        this.props.navigate("/");
                      })
                      .catch((e) => {
                        console.log(e.message);
                        if (e.message === "INVALID_OOB_CODE") {
                          window.alert(
                            `The ${email}-confirmation link was already either used or is just expired.`
                          );
                          this.props.navigate("/login");
                        }
                      });
                  const cb = (success) =>
                    this.setState({
                      humanCodeCredential: !success
                    }); //reauth then //if (this.state.humanCodeCredential === 2)
                  sendSignInLinkToEmail(getAuth(), this.props.auth.email, {
                    handleCodeInApp: true,
                    url: window.location.href
                  })
                    .then(() => {
                      window.alert("visit your email");
                      cb(true);
                    })
                    .catch(() => cb()); //this would invalidate phone auth?
                  //https://firebase.google.com/docs/auth/flutter/email-link-auth
                })
                .catch(standardCatch);
            }}
            //src={""}
            style={{
              display: "flex",
              position: "absolute",
              right: "0px",
              margin: "10px",
              width: "36px",
              top: "0px",
              border: "1px solid" + (this.props.stripe ? " pink" : " black"),
              height: "36px",
              backgroundColor:
                !this.state.submitStripe && this.state.openFormSecure
                  ? "rgb(255,217,102)" //"rgb(146,184,218)"
                  : "rgb(25,35,25)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: "1",
              color:
                !this.state.submitStripe && this.state.openFormSecure
                  ? "navy" //"rgb(207,226,243)" // "rgb(207,226,243)" //"rgb(146,184,218)"
                  : "white"
            }}
            //alt="err"
          >
            +
          </div>
          <span
            style={{
              border: "1px solid",
              padding: !this.props.hide && "0px 6px"
            }}
            onClick={async () => {
              const answer = window.confirm(
                "Do you want to delete this email?"
              );

              if (answer)
                await fetch(
                  `https://king-prawn-app-j2f2s.ondigitalocean.app/deleteemail`,
                  {
                    method: "POST",
                    //credentials: "include",
                    headers: {
                      "Content-Type": "Application/JSON",
                      "Access-Control-Request-Method": "POST",
                      "Access-Control-Request-Headers": [
                        "Origin",
                        "Content-Type"
                      ] //allow referer
                    },
                    body: JSON.stringify(this.props.auth), //getAuth().currentUser
                    maxAge: 3600
                    //"mode": "cors",
                  }
                )
                  .then(async (response) => await response.json())
                  .then((body) => {
                    window.alert(body);
                  })
                  .catch((err) => console.log(err));
            }}
          >
            &times;
          </span>
          &nbsp;
          <span
            style={{
              fontFamily: "'Plaster', cursive",
              fontWeight: "normal"
            }}
          >
            <span
              onClick={() => {
                const answer = window.prompt("update decanter email");
                if (answer && this.props.isEmail(answer)) {
                  this.props.handleUpdateEmail(answer);
                }
              }}
              style={{ border: "1px dotted", fontWeight: "bolder" }}
            >
              {this.props.auth.emailVerified
                ? "recovery email"
                : "verification required"}
            </span>
            {space}
            <span
              style={{
                transition: ".3s ease-in",
                color: this.props.auth.emailVerified ? "white" : "",
                backgroundColor: this.props.auth.emailVerified
                  ? "cornflowerblue"
                  : ""
              }}
              //onClick={() => window.alert("Vau.money personal trustee")}
            >
              {this.props.auth.email}
            </span>
          </span>
        </div>
        <br />
        {this.props.user !== undefined &&
          this.props.auth.email &&
          this.props.auth.emailVerified &&
          !this.props.user.stripeLink && (
            <div
              onClick={() => {
                if (false && user.customerId) {
                  updateDoc(doc(firestore, "userDatas", this.props.auth.uid), {
                    customerId: deleteField()
                  });
                  return this.deleteThese([], [user.customerId]);
                }
                this.setState({ openFormSecure: !this.state.openFormSecure });
              }}
            >
              {
                user.customerId
                  ? "Edit"
                  : this.props.user.stripeId
                  ? "Add"
                  : "Enroll"
                //Custom
              }
            </div>
          )}
        {this.state.openFormSecure && (
          <div>
            <form
              onSubmit={
                (e) => {
                  e.preventDefault();
                  /*fetch("https://geolocation-db.com/json/")
            .then(async (res) => await res.json())
            .then((r) => {
              const IPv4 = r.IPv4;
              //console.log(IPv4);
              this.setState({ IPv4 }, () => {*/
                  this.setState({ submitStripe: true });
                }
                //submitBank()
                //});}).catch((err) => console.log(err.message))
              }
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: this.state.openFormSecure ? "" : "0px"
              }}
            >
              <button type="submit">submit</button>
              <div
                style={{
                  fontSize: "0px",
                  overflow: "hidden",
                  height: "0px",
                  position: "relative"
                }}
              >
                <div style={{ position: "absolute" }}>
                  {this.state.submitStripe && (
                    <Elements stripe={stripePromise} options={null}>
                      <ElementsConsumer>
                        {(props) => {
                          const { stripe, elements } = props;
                          //console.log("striping");
                          return (
                            <STRIPE_ADDRESS
                              saveaddress={(e) => {
                                console.log(e);
                                this.setState({
                                  ...e,
                                  last: this.state.last,
                                  first: this.state.first
                                });
                              }}
                              noAccountYetArray={this.props.noAccountYetArray}
                              stripe={stripe}
                              auth={this.props.auth}
                              user={user}
                              first={this.state.first}
                              last={this.state.last}
                              options={{
                                mode: "shipping",
                                fields: {
                                  //name: "never",
                                  //firstName: "always",
                                  //lastName: "always"
                                },
                                display: {
                                  name: "split"
                                },
                                defaultValues: {
                                  firstName: this.state.first,
                                  lastName: this.state.last,
                                  /*name: this.state.first +
                          " " +
                          this.state.last,*/
                                  address: {
                                    line1: this.state.billing_details.line1,
                                    line2: this.state.billing_details.line2,
                                    city: this.state.billing_details.city,
                                    state: this.state.billing_details.state,
                                    postal_code: this.state.billing_details
                                      .postal_code,
                                    country: this.state.billing_details.country
                                  }
                                }
                                //If you want to use Payment Element, it is required to pass in the clientSecret.
                                // passing the client secret obtained from the server
                                //clientSecret: "{{CLIENT_SECRET}}"
                                //https://stripe.com/docs/stripe-js/react
                                //https://stripe.com/docs/elements/address-element/collect-addresses?platform=web&client=react
                              }}
                            />
                          );
                        }}
                      </ElementsConsumer>
                    </Elements>
                  )}
                </div>
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
                    <td
                      style={{
                        width: "calc(50% - 4px)",
                        paddingRight: "6px"
                      }}
                      //<div style={{ width: "100%", display: "flex" }}>
                    >
                      <input
                        style={inputStyle}
                        required={true}
                        value={this.state.first}
                        onChange={(e) =>
                          this.setState({
                            first: specialFormatting(e.target.value)
                          })
                        }
                        id="first"
                        placeholder="first"
                      />
                    </td>
                    <td style={{ width: "calc(50% - 4px)" }}>
                      {space}
                      <input
                        style={inputStyle}
                        required={true}
                        value={this.state.last}
                        onChange={(e) =>
                          this.setState({
                            last: specialFormatting(e.target.value)
                          })
                        }
                        id="last"
                        placeholder="last"
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
            </form>
          </div>
        )}
        {this.props.user !== undefined && this.state.address && (
          <div onClick={() => makeAccount()}>Apply</div>
        )}
        {user && user.stripeLink && (
          <a href={user && user.stripeLink}>Reset link</a>
        )}
        {user !== undefined && user.customerId && (
          <div>
            <h2
              style={{
                display: "block"
              }}
            >
              {true && (
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
                          customerId: user.customerId
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
              )}
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
                                border:
                                  this.state.chosenMethod === x
                                    ? "1px solid"
                                    : "none"
                              }}
                              onClick={() => {
                                this.setState({ chosenMethod: x });
                              }}
                            >
                              {obj.card.brand}
                              {space}(&bull;&bull;&bull;{obj.card.last4}):
                              {obj.card.exp_month}/{obj.card.exp_year}
                            </div>
                          ) : (
                            <div
                              style={{
                                border:
                                  this.state.chosenMethod === x
                                    ? "1px solid"
                                    : "none"
                              }}
                              onClick={() => {
                                this.setState({ chosenMethod: x });
                              }}
                            >
                              {obj.us_bank_account.bank_name}
                              {space}(&bull;&bull;&bull;
                              {obj.us_bank_account.last4}
                              ):{obj.us_bank_account.account_type}
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
                </div>
              )}
              <select
                value={this.state.payoutType}
                onChange={async (e) => {
                  this.setState(
                    {
                      clientSecret: null,
                      payoutType: e.target.value
                    },
                    async () => {
                      if (e.target.value !== "setup") {
                        const bankcard =
                          e.target.value === "Bank"
                            ? "us_bank_account"
                            : "card";
                        console.log(bankcard);
                        await fetch(
                          "https://king-prawn-app-j2f2s.ondigitalocean.app/add",
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
                              bankcard
                            })
                          }
                        )
                          .then(async (res) => await res.json())
                          .then(async (result) => {
                            if (result.status) return console.log(result);
                            if (result.error) return console.log(result);
                            if (!result.setupIntent)
                              return console.log("dev error (Cash)", result);
                            const clientSecret =
                              result.setupIntent.client_secret;
                            if (clientSecret) this.setState({ clientSecret });
                          })
                          .catch(standardCatch);
                      }
                    }
                  );
                }}
              >
                {["setup", "Card", "Bank"].map((x) => {
                  return <option key={x + "payout"}>{x}</option>;
                })}
              </select>
            </h2>
            {false && this.state.confirmBank && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  if (this.state.confirmBank === "bank")
                    return this.state.stripe
                      .confirmUsBankAccountSetup(this.state.clientSec, {
                        payment_method: {
                          us_bank_account: {
                            routing_number: this.state.routing_number,
                            account_number: this.state.account_number,
                            account_holder_type: "individual"
                          },
                          billing_details: {
                            name: user.first + " " + user.last,
                            email: this.props.auth.email
                          }
                        }
                      })
                      .then(function (result) {
                        if (result.error) {
                          // Inform the customer that there was an error.
                          console.log(result);
                        } else {
                          // Handle next step based on SetupIntent's status.
                          console.log(
                            "SetupIntent ID: " + result.setupIntent.id
                          );
                          console.log(
                            "SetupIntent status: " + result.setupIntent.status
                          );
                        }
                      });
                  this.state.stripe
                    .confirmCardSetup(this.state.clientSec, {
                      payment_method: {
                        card: this.state.elements,
                        billing_details: {
                          name: user.first + " " + user.last
                        }
                      }
                    })
                    .then(function (result) {
                      // Handle result.error or result.setupIntent
                    });
                }}
              >
                {this.state.confirmBank === "bank" && (
                  <div>
                    <input
                      required={true}
                      placeholder="account"
                      value={this.state.account_number}
                      onChange={(e) => textu(e, "account_number")}
                    />
                    <input
                      required={true}
                      placeholder="routing"
                      value={this.state.routing_number}
                      onChange={(e) => textu(e, "routing_number")}
                    />
                  </div>
                )}
                <button type="submit">confirm account</button>
              </form>
            )}
            {user && user[`microLink`] && (
              <a href={user[`microLink`]}>Verify</a>
            )}
            {this.state.clientSecret && this.state.payoutType !== "setup" && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: this.state.clientSecret
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
                    return (
                      stripe &&
                      (() => {
                        return (
                          <form
                            onSubmit={async (event) => {
                              event.preventDefault();
                              if (!stripe || !elements) return null;
                              elements.submit();
                              const { error } = await stripe.confirmSetup({
                                clientSecret: this.state.clientSecret,
                                //`Elements` instance that was used to create the Payment Element
                                elements,
                                confirmParams: {
                                  return_url: `https://${window.location.hostname}`
                                }
                              });
                              if (error) return console.log(error);
                              return console.log("ok confirmed setup");
                            }}
                          >
                            <PaymentElement />

                            <div>
                              {this.state.payoutType !== "Bank" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    width: "100%"
                                  }}
                                >
                                  <input
                                    placeholder="First"
                                    value={user.first}
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
                                    placeholder="Last"
                                    value={user.last}
                                    style={{ width: "33%" }}
                                  />
                                </div>
                              ) : null}
                            </div>
                            <button disabled={!stripe}>Submit</button>
                          </form>
                        );
                      })()
                    );
                  }}
                </ElementsConsumer>
              </Elements>
            )}
          </div>
        )}
        {user && user[`microLink`] && (
          <a style={{ color: "white" }} href={user[`microLink`]}>
            Verify
          </a>
        )}
        <span
          onClick={async () => {
            await fetch(
              "https://king-prawn-app-j2f2s.ondigitalocean.app/balance",
              {
                method: "POST",
                headers: {
                  "Content-Type": "Application/JSON",
                  "Access-Control-Request-Method": "POST",
                  "Access-Control-Request-Headers": ["Origin", "Content-Type"] //allow referer
                },
                body: JSON.stringify({})
              }
            )
              .then(async (res) => await res.json())
              .then(async (result) => {
                if (result.status) return console.log(result);
                if (result.error) return console.log(result);
                if (!result.balance)
                  return console.log("dev error (Cash)", result);
                const balance = result.balance.available[0].amount;
                console.log(balance);
                this.setState({ balance });
              })
              .catch(standardCatch);
          }}
        >
          get balance
        </span>
        : $
        <span
          onClick={async () => {
            return null;
            await fetch(
              "https://king-prawn-app-j2f2s.ondigitalocean.app/payout",
              {
                method: "POST",
                headers: {
                  "Content-Type": "Application/JSON",
                  "Access-Control-Request-Method": "POST",
                  "Access-Control-Request-Headers": ["Origin", "Content-Type"] //allow referer
                },
                body: JSON.stringify({
                  total: this.state.balance,
                  storeId: this.props.user.stripeId
                })
              }
            )
              .then(async (res) => await res.json())
              .then(async (result) => {
                if (result.status) return console.log(result);
                if (result.error) return console.log(result);
                if (!result.payout)
                  return console.log("dev error (Cash)", result);
                const payout = result.payout;
                console.log(payout);
                this.setState({ payout });
              })
              .catch(standardCatch);
          }}
        >
          {this.state.balance}
        </span>
        <br />
        Login to stripe.com to payout.
      </div>
    );
  }
}
export default Bank;
