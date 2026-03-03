/**
 * Table of contents
 * -----------------------------------
 * 01.CURRENT TIME
 * 02.OPEN BUTTON
 * 03.CHECK AVAILABILITY
 * 04.GET WEEK DAY
 * 05.MULTI USER AVAILABILITY
 * 06.MULTI USER SEARCH
 * 07.BUTTONS AVAILABILITY
 * 08.SINGLE CHAT AVAILABILITY
 * DARK VERSION
 * -----------------------------------
 */

"use strict";
let teleSupport = document.querySelectorAll(".teleSupport");
let teleSupportMulti = document.querySelectorAll(".teleSupport-multi");
let teleSupportBubble = document.querySelectorAll(".teleSupport-bubble");
let currentTime = document.querySelector(".current-time");
let teleSupportUserAvailability = document.querySelectorAll(".teleSupportUserAvailability");
let teleSupportSendMessage = document.querySelector(".teleSupport__send-message");
let teleSupportMultiPopupContent = document.querySelector(".teleSupport-multi__popup--content");
let user = document.querySelector(".user");

/******************** 01.CURRENT TIME  ********************/

let today = new Date();
if (currentTime !== null) {
  let time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  currentTime.innerText = time;
}
/******************** 02.OPEN BUTTON  ********************/
const openChatBtn = () => {
  teleSupport.forEach((item) => {
    item.classList?.toggle("teleSupport-show");
  });
  teleSupportMulti.forEach((item) => {
    item.classList?.toggle("teleSupport-show");
  });
};
teleSupportBubble.forEach((item) => {
  item.addEventListener("click", openChatBtn);
});

/******************** 03.CHECK AVAILABILITY  ********************/
function is_available(available, now) {
  let is_available = false;
  let almost_available = false;
  for (let key in available) {
    if (available.hasOwnProperty(key)) {
      if (get_day_of_week(key) == now.day()) {
        let start = moment(available[key].split("-")[0], "HH:mm"); // available[key] is in this format: 8:00-18:33
        let end = moment(available[key].split("-")[1], "HH:mm"); // available[key] is in this format: 8:00-18:33
        if (moment().isAfter(start) && moment().isBefore(end)) {
          is_available = true;
        } else if (now.isBefore(start)) {
          almost_available = true;
        }
      }
    }
  }
  return { is_available: is_available, almost_available: almost_available };
}

/******************** 04.GET WEEK DAY  ********************/
function get_day_of_week(name) {
  name = name.toLowerCase();
  if (name == "sunday") {
    return 0;
  } else if (name == "monday") {
    return 1;
  } else if (name == "tuesday") {
    return 2;
  } else if (name == "wednesday") {
    return 3;
  } else if (name == "thursday") {
    return 4;
  } else if (name == "friday") {
    return 5;
  } else if (name == "saturday") {
    return 6;
  }
}

/******************** 05.MULTI USER AVAILABILITY  ********************/
const searchInfo = teleSupportMultiPopupContent?.getAttribute("data-search");
const isGrid = document
  .querySelector(".teleSupport-multi")
  ?.classList.contains("teleSupport-grid");

if (teleSupportUserAvailability !== undefined) {
  if (searchInfo === "true") {
    teleSupportMultiPopupContent.classList.add("teleSupport-search");
  }
  if (teleSupportUserAvailability.length > 3 && !isGrid) {
    teleSupportMultiPopupContent.classList.add("teleSupport-scroll");
  }
  if (teleSupportUserAvailability.length > 4 && isGrid) {
    teleSupportMultiPopupContent.classList.add("teleSupport-scroll");
  }
  teleSupportUserAvailability.forEach((item) => {
    const availableTimes = item.getAttribute("data-useravailability");
    const timezone = item.getAttribute("data-timezone");
    let now = timezone ? moment().tz(timezone) : moment();
    let available = is_available(JSON.parse(availableTimes), now);

    if (available.is_available || availableTimes == null) {
      teleSupportUserAvailability.forEach((item) => {
        const availableTime = item.getAttribute("data-useravailability");
        if (availableTime === availableTimes) {
          item.classList.add("avatar-active");
          item.classList.remove("avatar-inactive");
        }
      });
    } else {
      teleSupportUserAvailability.forEach((item) => {
        const availableTime = item.getAttribute("data-useravailability");
        if (availableTime === availableTimes) {
          item.classList.add("avatar-inactive");
          item.setAttribute("disabled", "");
          item.classList.remove("avatar-active");
        }
      });
    }
  });
}
/******************** 06.MULTI USER SEARCH  ********************/
function searchUser() {
  var searchKeyword, i, txtValue;
  let input = document.getElementById("search-input");
  let filter = input.value.toUpperCase();
  let multiUser = document.getElementById("multi-user");
  let user = multiUser.getElementsByClassName("user");

  for (i = 0; i < user.length; i++) {
    searchKeyword = user[i].getElementsByClassName("user__info--name")[0];
    txtValue = searchKeyword.textContent || searchKeyword.innerText;
    if (txtValue.toUpperCase().indexOf(filter) > -1) {
      user[i].style.display = "";
    } else {
      user[i].style.display = "none";
    }
  }
}

/******************** 07.BUTTONS AVAILABILITY  ********************/
let teleSupportButtons = document.querySelectorAll(".teleSupportButtons");
if (teleSupportButtons !== undefined) {
  teleSupportButtons.forEach((item) => {
    const availableTimes = item.getAttribute("data-btnavailablety");
    const timezone = item.getAttribute("data-timezone");
    let now = timezone ? moment().tz(timezone) : moment();
    let available = is_available(JSON.parse(availableTimes), now);

    if (available.is_available) {
      teleSupportButtons.forEach((item) => {
        const availableTime = item.getAttribute("data-btnavailablety");
        if (availableTime === availableTimes) {
          item.classList.add("avatar-active");
          item.classList.remove("avatar-inactive");
        }
      });
    } else {
      teleSupportButtons.forEach((item) => {
        const availableTime = item.getAttribute("data-btnavailablety");
        if (availableTime === availableTimes) {
          item.classList.add("avatar-inactive");
          item.classList.remove("avatar-active");
        }
      });
    }
  });
}

/******************** 08.SINGLE CHAT AVAILABILITY  ********************/
const chatAvailability = document.querySelector(".chat-availability");

if (chatAvailability) {
  const chatAvailableTime = chatAvailability.getAttribute("data-availability");
  if (chatAvailableTime !== undefined) {
    let now = moment();
    let available = is_available(JSON.parse(chatAvailableTime), now);

    if (available.is_available || chatAvailableTime == null) {
      chatAvailability.classList.add("avatar-active");
      chatAvailability.classList.remove("avatar-inactive");
    } else {
      chatAvailability.classList.add("avatar-inactive");
      chatAvailability.classList.remove("avatar-active");
    }
  }
}
