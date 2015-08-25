
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
  response.success("Hello world!");
});

function sendDoneNotification(seller) {
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo("user", seller);
    Parse.Push.send({
        where: pushQuery,
        data: {
            title: "任務成交",
            alert: "恭喜你的任務成交囉～快去看看吧～"
        }
    });
}

Parse.Cloud.define("createChatConnection", function(request, response) {
    Parse.Cloud.useMasterKey();
    var senderId = request.params.senderId;
    var recipientId = request.params.recipientId;

    var senderQuery = new Parse.Query(Parse.User);
    senderQuery.get(senderId, {
        success: function(sender) {
            var recipientQuery = new Parse.Query(Parse.User);
            recipientQuery.get(recipientId, {
                success: function(recipient) {
                    // Now we have both sender and recipient
                    var senderFriends = sender.relation("friends");
                    var recipientFriends = recipient.relation("friends");
                    senderFriends.add(recipient);
                    recipientFriends.add(sender);

                    sender.save(null, {
                      success: function(buyer) {
                          console.log("save success");
                      },
                      error: function(buyer, error) {
                          console.log("ERROR");
                      }
                    });

                    recipient.save(null, {
                      success: function(buyer) {
                          console.log("save success");
                      },
                      error: function(buyer, error) {
                          console.log("ERROR");
                      }
                    });

                } // successfully get recipient
            });
        } // successfully get sender

    });

});

Parse.Cloud.define("notifySellerAccept", function(request, response) {
    var buyerId = request.params.buyerId;
    var buyerQuery = new Parse.Query(Parse.User);
    buyerQuery.get(buyerId, {
        success: function(buyer) {
            var pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.equalTo("user", buyer);
            Parse.Push.send({
                where: pushQuery,
                data: {
                    title: "有人接受你的任務囉～",
                    alert: "有人接受你發的任務囉～～快去看看吧～～"
                }
            });
        }
    });
});

Parse.Cloud.define("doneTask", function(request, response) {
    Parse.Cloud.useMasterKey();
    var taskId = request.params.taskId;
    var buyerId = request.params.buyerId;
    var sellerId = request.params.sellerId;
    // move task from buyer new to done
    console.log("hahaha");
    var query = new Parse.Query(Parse.Object.extend("Question"));
    query.get(taskId, {
        success: function(task) {
            // move from buyer new question to done question
            var buyerQuery = new Parse.Query(Parse.User);
            buyerQuery.get(buyerId, {
                success: function(buyer) {
                    var myNewQuestions = buyer.relation("myNewQuestions");
                    var myDoneQuestions = buyer.relation("myDoneQuestions");
                    myNewQuestions.remove(task);
                    myDoneQuestions.add(task);
                    buyer.save(null, {
                        success: function(buyer) {
                            console.log("save success");
                        },
                        error: function(buyer, error) {
                            console.log("fuckkkkk");
                        }
                    });
                }
            });
            // move from seller accepted question to done question
            var sellerQuery = new Parse.Query(Parse.User);
            sellerQuery.get(sellerId, {
                success: function(seller) {
                    var sellerAcceptedQuestions = seller.relation("acceptedQuestions");
                    var sellerDoneQuestions = seller.relation("doneQuestions");
                    sellerAcceptedQuestions.remove(task);
                    sellerDoneQuestions.add(task);
                    seller.save();
                    sendDoneNotification(seller);

                    task.set("doneUser", seller);
                    task.save();
                }
            });
            // delete other seller accepted question
            var acceptedUser = task.relation("acceptedUser");
            var userQuery = acceptedUser.query();
            userQuery.find({
                success: function(users) {
                    for (var i = 0; i < users.length; i++) {
                        var seller = users[i];
                        var sellerAcceptedQuestions = seller.relation("acceptedQuestions");
                        sellerAcceptedQuestions.remove(task);
                        seller.save();

                        acceptedUser.remove(seller);
                    }
                    task.save();
                }
            });
        },
        error: function(task, error) {
            console.log("fuckkkkk");
        }
    });
});

Parse.Cloud.afterSave("Question", function(request) {
    Parse.Cloud.useMasterKey();
    var task = request.object;
    if(task.existed() == false) {
        var query = new Parse.Query(Parse.User);
        var taskPin = task.get("pin");
        query.find({
            success: function(users) {
                for (var i = 0; i < users.length; i++) {
                    var user = users[i];
                    if(user.id == task.get("user").id) {
                        continue;
                    }
                    var pin = user.get("pin");
                    var radius = user.get("radius");
                    if(pin && pin.kilometersTo(taskPin) > radius)  {
                        continue;
                    }

                    var relation = user.relation("catchQuestions");
                    relation.add(task);
                    user.save(null, {
                        success: function(user) {
                            console.log("save user");
                        },
                        error: function(gameScore, error) {
                            console.log("fail to save user");
                        }
                    });

                    // push notification to user
                    var pushQuery = new Parse.Query(Parse.Installation);
                    pushQuery.equalTo("user", user);
                    Parse.Push.send({
                        where: pushQuery,
                        data: {
                            title: "發任務囉～",
                            alert: "你接到新任務囉～～快去看看吧～～"
                        }
                    });
                }
            }
        });
    }
});

Parse.Cloud.define("instantMessageNotification", function(request, response) {
  Parse.Cloud.useMasterKey();
  var senderId = request.params.senderId;
  var recipientId = request.params.recipientId;

  var senderQuery = new Parse.Query(Parse.User);
  senderQuery.get(senderId, {
    success: function(sender){
        var recipientQuery = new Parse.Query(Parse.User);
        recipientQuery.get(recipientId, {
            success: function(recipient) {
                sendIMNotification(sender, recipient, senderId);
            }
        });
    }
  });

});

function sendIMNotification(sender, recipient, senderId) {
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo("user", recipient);
    pushQuery.equalTo("inMessagingActivity", false);
    Parse.Push.send({
        where: pushQuery,
        data: {
            title: sender.get("nickname"),
            uri: "nest://IMNotifSender/" + senderId,
            alert: "Message Content"
        }
    }, {
      success: function() {
        // Push was successful
      },
      error: function(error) {
        // Handle error
      }
    });
}
