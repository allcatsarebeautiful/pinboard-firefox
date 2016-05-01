{
    var app = angular.module('popupApp', []);

    app.controller(
        'PopupCtrl',
        ['$rootScope', '$scope', '$window',
            function ($rootScope, $scope, $window) {
                var bg = chrome.extension.getBackgroundPage(),
                    keyCode = { enter: 13, tab: 9, up: 38, down: 40, ctrl: 17, n: 78, p: 80, space: 32 },
                    SEC = 1000, MIN = SEC * 60, HOUR = MIN * 60, DAY = HOUR * 24, WEEK = DAY * 7;
                Date.prototype.getTimePassed = function () {
                    var ret = { day: 0, hour: 0, min: 0, sec: 0, offset: -1 },
                        offset = new Date() - this, r;
                    if (offset <= 0) return ret;
                    ret.offset = offset;
                    ret.week = Math.floor(offset / WEEK); r = offset % WEEK;
                    ret.day = Math.floor(offset / DAY); r = offset % DAY;
                    ret.hour = Math.floor(r / HOUR); r = r % HOUR;
                    ret.min = Math.floor(r / MIN); r = r % MIN;
                    ret.sec = Math.floor(r / SEC);
                    return ret;
                };

                $window.$rootScope = $rootScope;

                $scope.$on('login-failed', function () {
                    $scope.isLoading = false;
                    $scope.isLoginError = true;
                    $scope.$apply();
                });

                $scope.$on('login-succeed', function () {
                    renderPageInfo();
                });

                $scope.$on('logged-out', function () {
                    $scope.isAnony = true;
                    $scope.isLoading = false;
                    $scope.isLoginError = false;
                    $scope.$applyAsync();
                });

                $scope.$on('addpost-failed', function () {
                    $scope.isLoading = false;
                    $scope.isPostError = true;
                    $scope.$apply();
                });

                $scope.$on('addpost-succeed', function () {
                    $window.close();
                });

                $scope.$on('deletepost-failed', function () {
                    $scope.isLoading = false;
                    $scope.isPostError = true;
                    $scope.$apply();
                });

                $scope.$on('deletepost-succeed', function () {
                    $window.close();
                });

                $scope.$on('show-loading', function (e, loadingText) {
                    $scope.isLoading = true;
                    $scope.loadingText = loadingText || 'Loading...';
                    $scope.$apply();
                });

                var copySelOrMetaToDesc = function () {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tab) {
                        // @TODO: get desc from tab, firefox dose not support tabs.sendRequest() currently(45.0)
                    });
                };

                var initAutoComplete = function () {
                    var tags = bg.getTags();
                    if (tags && tags.length) {
                        $scope.allTags = tags;
                    }
                };

                var renderPageInfo = function () {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        var tab = tabs[0];
                        if (tab.url.indexOf("http://") !== 0 && tab.url.indexOf("https://") !== 0) {
                            pageInfo = {};
                            pageInfo.isSaved = false;
                            $scope.pageInfo = _.clone(pageInfo); // do not deep copy

                            $scope.loadingText = 'Please select a valid tab';
                            $scope.isLoading = true;
                            $scope.isAnony = false;
                            $scope.$apply();
                            return;
                        }
                        var pageInfo = bg.getPageInfo(tab.url);
                        if (!pageInfo || pageInfo.isSaved == false) {
                            pageInfo = {
                                url: tab.url, title: tab.title,
                                tag: '', desc: ''
                            };
                            pageInfo.shared = (localStorage[allprivateKey] !== 'true');
                            pageInfo.isPrivate = !pageInfo.shared;
                            pageInfo.isSaved = false;
                        }
                        if (pageInfo.tag) {
                            pageInfo.tag = pageInfo.tag.concat(' ');
                        }
                        pageInfo.isPrivate = !pageInfo.shared;
                        $scope.pageInfo = _.clone(pageInfo); // do not deep copy
                        if (!pageInfo.desc) {
                            copySelOrMetaToDesc();
                        }
                        $scope.isLoading = false;
                        $scope.isAnony = false;
                        $scope.$apply();
                        bg.getSuggest(tab.url);
                        initAutoComplete();
                        if (location.search != "?focusHack") {
                            location.search = "?focusHack";
                        }
                    });
                };

                $scope.chooseTag = function (e) {
                    var code = e.charCode ? e.charCode : e.keyCode;
                    if (code &&
                        _.indexOf([keyCode.enter, keyCode.tab, keyCode.up, keyCode.down,
                            keyCode.n, keyCode.p, keyCode.ctrl, keyCode.space],
                            code) >= 0) {
                        if (code == keyCode.enter || code == keyCode.tab) {
                            if ($scope.isShowAutoComplete) {
                                e.preventDefault();
                                // submit tag
                                var items = $scope.pageInfo.tag.split(' '),
                                    tag = $scope.autoCompleteItems[$scope.activeItemIndex];
                                items.splice(items.length - 1, 1, tag.text);
                                $scope.pageInfo.tag = items.join(' ') + ' ';
                                $scope.isShowAutoComplete = false;
                            } else if (code == keyCode.enter) {
                                $scope.postSubmit();
                            }
                        } else if (code == keyCode.down ||
                            (code == keyCode.n && e.ctrlKey == true)) {
                            // move up one item
                            e.preventDefault();
                            var idx = $scope.activeItemIndex + 1;
                            if (idx >= $scope.autoCompleteItems.length) {
                                idx = 0;
                            }
                            $scope.autoCompleteItems =
                                _.map($scope.autoCompleteItems,
                                    function (item) {
                                        return { text: item.text, isActive: false };
                                    });
                            $scope.activeItemIndex = idx;
                            $scope.autoCompleteItems[idx].isActive = true;
                        } else if (code == keyCode.up ||
                            (code == keyCode.p && e.ctrlKey == true)) {
                            // move down one item
                            e.preventDefault();
                            var idx = $scope.activeItemIndex - 1;
                            if (idx < 0) {
                                idx = $scope.autoCompleteItems.length - 1;
                            }
                            $scope.autoCompleteItems =
                                _.map($scope.autoCompleteItems,
                                    function (item) {
                                        return { text: item.text, isActive: false };
                                    });
                            $scope.activeItemIndex = idx;
                            $scope.autoCompleteItems[idx].isActive = true;
                        } else if (code == keyCode.space) {
                            $scope.isShowAutoComplete = false;
                        }
                    }
                };

                $scope.showAutoComplete = function () {
                    var items = $scope.pageInfo.tag.split(' '),
                        word = items[items.length - 1],
                        MAX_SHOWN_ITEMS = 5;
                    if (word) {
                        word = word.toLowerCase();
                        var allTags = $scope.allTags,
                            shownCount = 0, autoCompleteItems = [];
                        for (var i = 0, len = allTags.length; i < len && shownCount < MAX_SHOWN_ITEMS; i++) {
                            var tag = allTags[i].toLowerCase();
                            if (tag.indexOf(word) == 0) {
                                var item = { text: tag, isActive: false };
                                autoCompleteItems.push(item);
                                shownCount += 1;
                            }
                        }
                        if (shownCount) {
                            $scope.autoCompleteItems = autoCompleteItems.reverse();
                            $scope.autoCompleteItems[0].isActive = true;
                            $scope.activeItemIndex = 0;
                            $scope.isShowAutoComplete = true;
                            var tagEl = $('#tag'), pos = $('#tag').offset();
                            pos.top = pos.top + tagEl.outerHeight();
                            $scope.autoCompleteStyle = { 'left': pos.left, 'top': pos.top };
                        } else {
                            $scope.isShowAutoComplete = false;
                        }
                    } else {
                        $scope.isShowAutoComplete = false;
                    }
                };

                $scope.$on('render-page-info', renderPageInfo);

                var addTag = function (s) {
                    var t = $scope.pageInfo.tag;
                    // skip if tag already added
                    if ($.inArray(s, t.split(' ')) == -1) {
                        $scope.pageInfo.tag = t + ' ' + s;
                    }
                };

                $scope.addTags = function (tags) {
                    $.each(tags, function (index, tag) {
                        addTag(tag);
                    });
                };

                $scope.$on('render-suggests', function (e, suggests) {
                    $scope.suggests = suggests;
                    $scope.$apply();
                });

                $scope.openUrl = function (url) {
                    chrome.tabs.query({}, function (tabs) {
                        index = tabs.length;
                        chrome.tabs.create({ url: url, index: index });
                        // avaiable from Firefox 47,
                        // @see https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Anatomy_of_a_WebExtension#Browser_actions_2
                        $window.close();
                    });
                };

                // @FIXME: avaiable from 48.0?
                $scope.openOption = function () {
                    chrome.runtime.openOptionsPage();
                }

                $scope.renderSavedTime = function (time) {
                    var passed = new Date(time).getTimePassed(),
                        dispStr = 'previously saved ',
                        w = passed.week, d = passed.day, h = passed.hour;
                    if (passed.offset > WEEK) {
                        dispStr = dispStr.concat(passed.week, ' ', 'weeks ago');
                    } else if (passed.offset > DAY) {
                        dispStr = dispStr.concat(passed.day, ' ', 'days ago');
                    } else if (passed.offset > HOUR) {
                        dispStr = dispStr.concat(passed.hour, ' ', 'hours ago');
                    } else {
                        dispStr = dispStr.concat('just now');
                    }
                    return dispStr;
                };

                $scope.postSubmit = function () {
                    $scope.isLoading = true;
                    $scope.loadingText = 'Saving...';
                    var info = _.clone($scope.pageInfo);
                    info.shared = $scope.pageInfo.isPrivate ? 'no' : 'yes';
                    info.toread = $scope.pageInfo.toread ? 'yes' : 'no';
                    bg.addPost(info);
                };

                $scope.showDeleteConfirm = function () {
                    $scope.isShowDeleteConfirm = true;
                };

                $scope.postDelete = function () {
                    $scope.isLoading = true;
                    $scope.loadingText = 'Deleting...';
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        var tab = tabs[0];
                        bg.deletePost(tab.url);
                    });
                };

                $scope.loginSubmit = function () {
                    if ($scope.userLogin.authToken) {
                        $scope.loadingText = 'Logging in...';
                        $scope.isLoading = true;
                        bg.login($scope.userLogin.authToken);
                    }
                };

                $scope.logout = function () {
                    bg.logout();
                };

                var userInfo = bg.getUserInfo();
                $scope.userInfo = userInfo;
                $scope.isAnony = !userInfo || !userInfo.isChecked;
                $scope.isLoading = false;
                $scope.loadingText = 'Loading...';
                if ($scope.isAnony) {
                    $scope.isLoginError = false;
                } else {
                    renderPageInfo();
                }
            }]
    );
}